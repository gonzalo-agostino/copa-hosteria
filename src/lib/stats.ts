import {
  Match,
  MatchEvent,
  Player,
  PlayerStatsRow,
  StandingRow,
  Team,
} from "@/types/tournament";

export type StatsScope = "2026" | "all";

export function getMatchScore(match: Match): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const ev of match.events) {
    if (ev.type === "gol") {
      if (ev.teamId === match.homeTeamId) home++;
      else if (ev.teamId === match.awayTeamId) away++;
    }
  }
  return { home, away };
}

export function getPlayerMatchCardState(match: Match, playerId: string) {
  let yellows = 0;
  let directReds = 0;
  let doubleYellow = false;

  for (const ev of match.events) {
    if (ev.playerId !== playerId) continue;
    if (ev.type === "amarilla") {
      yellows++;
      if (yellows >= 2 || ev.isSecondYellow) {
        doubleYellow = true;
      }
    } else if (ev.type === "roja") {
      directReds++;
    }
  }

  const isExpelled = directReds > 0 || doubleYellow;
  const reason =
    directReds > 0
      ? "Roja directa"
      : doubleYellow
        ? "Doble amarilla"
        : undefined;

  return { yellows, directReds, doubleYellow, isExpelled, reason };
}

export function getExpelledPlayersInMatch(match: Match): Map<string, string> {
  const expelled = new Map<string, string>();
  const playerIds = new Set(
    match.events
      .filter((e) => e.type === "amarilla" || e.type === "roja")
      .map((e) => e.playerId)
  );
  for (const pid of playerIds) {
    const state = getPlayerMatchCardState(match, pid);
    if (state.isExpelled && state.reason) {
      expelled.set(pid, state.reason);
    }
  }
  return expelled;
}

/**
 * Checks if a player is suspended for a specific match because they were
 * expelled in their team's immediately preceding match.
 */
export function getSuspendedPlayersForMatch(
  allMatches: Match[],
  targetMatch: Match
): Map<string, string> {
  const suspended = new Map<string, string>();

  const checkTeam = (teamId: string) => {
    if (!teamId) return;
    const teamMatches = allMatches
      .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.createdAt.localeCompare(b.createdAt);
      });

    const targetIdx = teamMatches.findIndex((m) => m.id === targetMatch.id);
    if (targetIdx <= 0) return;

    const prevMatch = teamMatches[targetIdx - 1];
    if (prevMatch.status === "pendiente") return;

    const expelled = getExpelledPlayersInMatch(prevMatch);
    expelled.forEach((reason, playerId) => {
      // Only flag if event belonged to this team
      const belonged = prevMatch.events.some(
        (e) =>
          e.playerId === playerId &&
          e.teamId === teamId &&
          (e.type === "amarilla" || e.type === "roja")
      );
      if (belonged) {
        suspended.set(
          playerId,
          `Suspendido (${reason} en ${prevMatch.roundLabel})`
        );
      }
    });
  };

  checkTeam(targetMatch.homeTeamId);
  checkTeam(targetMatch.awayTeamId);
  return suspended;
}

/**
 * Returns players who currently have an active next-match suspension
 * (expelled in their team's most recent played/live match).
 */
export function getActiveSuspensions(allMatches: Match[]): Map<string, string> {
  const suspended = new Map<string, string>();
  const playedByTeam = new Map<string, Match[]>();

  for (const m of allMatches) {
    if (m.status === "pendiente" && m.events.length === 0) continue;
    for (const tid of [m.homeTeamId, m.awayTeamId]) {
      if (!tid) continue;
      const list = playedByTeam.get(tid) ?? [];
      list.push(m);
      playedByTeam.set(tid, list);
    }
  }

  playedByTeam.forEach((teamMatches, teamId) => {
    const sorted = [...teamMatches].sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.createdAt.localeCompare(b.createdAt);
    });
    const lastMatch = sorted[sorted.length - 1];
    if (!lastMatch) return;
    const expelled = getExpelledPlayersInMatch(lastMatch);
    expelled.forEach((reason, playerId) => {
      const belonged = lastMatch.events.some(
        (e) =>
          e.playerId === playerId &&
          e.teamId === teamId &&
          (e.type === "amarilla" || e.type === "roja")
      );
      if (belonged) {
        suspended.set(
          playerId,
          `Suspendido próx. partido (${reason} · ${lastMatch.roundLabel})`
        );
      }
    });
  });

  return suspended;
}

export function calculateStandings(
  teams: Team[],
  matches: Match[]
): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      teamColor: t.color,
      pj: 0,
      g: 0,
      e: 0,
      p: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      pts: 0,
      tiebreakOrder: t.tiebreakOrder,
    });
  }

  for (const m of matches) {
    if (m.status === "pendiente") continue;
    if (m.stage === "playoff") continue;
    const homeRow = map.get(m.homeTeamId);
    const awayRow = map.get(m.awayTeamId);
    if (!homeRow || !awayRow) continue;

    const { home, away } = getMatchScore(m);
    homeRow.pj++;
    awayRow.pj++;
    homeRow.gf += home;
    homeRow.gc += away;
    awayRow.gf += away;
    awayRow.gc += home;

    if (home > away) {
      homeRow.g++;
      homeRow.pts += 3;
      awayRow.p++;
    } else if (away > home) {
      awayRow.g++;
      awayRow.pts += 3;
      homeRow.p++;
    } else {
      homeRow.e++;
      awayRow.e++;
      homeRow.pts += 1;
      awayRow.pts += 1;
    }
  }

  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    dg: r.gf - r.gc,
  }));

  rows.sort((a, b) => {
    // 1. Mayores puntos (Victoria = 3, Empate = 1)
    if (b.pts !== a.pts) return b.pts - a.pts;
    // 2. Mayor diferencia de gol
    if (b.dg !== a.dg) return b.dg - a.dg;
    // 3. Mayor cantidad de goles a favor
    if (b.gf !== a.gf) return b.gf - a.gf;
    // 4. Menos goles en contra
    if (a.gc !== b.gc) return a.gc - b.gc;
    // 5. Se tira la moneda (o desempate manual del organizador)
    const tbA = a.tiebreakOrder ?? 999;
    const tbB = b.tiebreakOrder ?? 999;
    if (tbA !== tbB) return tbA - tbB;
    return a.teamName.localeCompare(b.teamName, "es");
  });

  return rows;
}

export function areStandingsTiedOnStats(
  a: StandingRow,
  b: StandingRow
): boolean {
  return (
    a.pj > 0 &&
    b.pj > 0 &&
    a.pts === b.pts &&
    a.dg === b.dg &&
    a.gf === b.gf &&
    a.gc === b.gc
  );
}

export function getTiedStandingGroups(
  standings: StandingRow[]
): StandingRow[][] {
  const groups: StandingRow[][] = [];
  let i = 0;
  while (i < standings.length) {
    let j = i + 1;
    while (
      j < standings.length &&
      areStandingsTiedOnStats(standings[i], standings[j])
    ) {
      j++;
    }
    if (j - i >= 2) {
      groups.push(standings.slice(i, j));
    }
    i = j;
  }
  return groups;
}

export function calculatePlayerStats(
  players: Player[],
  teams: Team[],
  matches: Match[],
  scope: StatsScope
): PlayerStatsRow[] {
  const teamByPlayer = new Map<string, Team>();
  for (const t of teams) {
    for (const pid of t.playerIds) {
      teamByPlayer.set(pid, t);
    }
  }

  const activeSuspensions = getActiveSuspensions(matches);

  const statsMap = new Map<string, PlayerStatsRow>();
  for (const player of players) {
    if (scope === "2026" && !player.convocadoActual) continue;
    const team = teamByPlayer.get(player.id);
    const includeHistorical = scope === "all";
    statsMap.set(player.id, {
      player,
      teamName: team?.name,
      teamColor: team?.color,
      goals: includeHistorical ? (player.goals2024 ?? 0) + player.goals2025 : 0,
      assists: includeHistorical ? player.assists2025 : 0,
      yellowCards: includeHistorical ? player.yellowCards2025 : 0,
      redCards: includeHistorical ? player.redCards2025 : 0,
      doubleYellows: 0,
      expulsions: includeHistorical ? player.redCards2025 : 0,
      isSuspendedNextMatch: activeSuspensions.has(player.id),
      suspendedReason: activeSuspensions.get(player.id),
    });
  }

  for (const m of matches) {
    const matchYellowCount = new Map<string, number>();

    for (const ev of m.events) {
      const row = statsMap.get(ev.playerId);
      if (ev.type === "gol") {
        if (row) row.goals++;
        if (ev.assistPlayerId) {
          const assistRow = statsMap.get(ev.assistPlayerId);
          if (assistRow) assistRow.assists++;
        }
      } else if (ev.type === "amarilla") {
        if (row) {
          row.yellowCards++;
          const prev = matchYellowCount.get(ev.playerId) ?? 0;
          const next = prev + 1;
          matchYellowCount.set(ev.playerId, next);
          if (next === 2) {
            row.doubleYellows++;
            row.expulsions++;
          }
        }
      } else if (ev.type === "roja") {
        if (row) {
          row.redCards++;
          row.expulsions++;
        }
      }
    }
  }

  return Array.from(statsMap.values());
}

/**
 * Generates a balanced round-robin fixture (todos contra todos) using the circle method.
 */
export function generateRoundRobinMatches(teams: Team[]): Match[] {
  const validTeams = teams.filter((t) => t.name.trim().length > 0);
  if (validTeams.length < 2) return [];

  const list: (Team | null)[] = [...validTeams];
  if (list.length % 2 === 1) {
    list.push(null); // bye
  }

  const n = list.length;
  const totalRounds = n - 1;
  const matches: Match[] = [];
  const now = Date.now();
  let seq = 0;

  for (let round = 0; round < totalRounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const t1 = list[i];
      const t2 = list[n - 1 - i];
      if (!t1 || !t2) continue;

      const swap = round % 2 === 1 && i === 0;
      const home = swap ? t2 : t1;
      const away = swap ? t1 : t2;

      seq++;
      matches.push({
        id: `m-${now}-${seq}`,
        editionId: "ed-2026",
        round: round + 1,
        roundLabel: `Fecha ${round + 1}`,
        homeTeamId: home.id,
        awayTeamId: away.id,
        status: "pendiente",
        events: [],
        createdAt: new Date(now + seq * 1000).toISOString(),
      });
    }

    // Rotate all except index 0
    const fixed = list[0];
    const rest = list.slice(1);
    const last = rest.pop()!;
    list.splice(0, list.length, fixed, last, ...rest);
  }

  return matches;
}

export function getMatchWinnerTeamId(match: Match): string | null {
  if (match.status !== "finalizado") return null;
  const { home, away } = getMatchScore(match);
  if (home > away) return match.homeTeamId;
  if (away > home) return match.awayTeamId;

  const pHome = match.penaltiesHome ?? null;
  const pAway = match.penaltiesAway ?? null;
  if (pHome !== null && pAway !== null && pHome !== pAway) {
    return pHome > pAway ? match.homeTeamId : match.awayTeamId;
  }
  return null;
}

export function getMatchLoserTeamId(match: Match): string | null {
  const winner = getMatchWinnerTeamId(match);
  if (!winner) return null;
  return winner === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
}

export function generatePlayoffSemifinals(
  standings: StandingRow[],
  startRound = 100
): Match[] {
  if (standings.length < 4) return [];
  const [first, second, third, fourth] = standings;
  const now = Date.now();

  return [
    {
      id: `po-sf1-${now}`,
      editionId: "ed-2026",
      round: startRound,
      roundLabel: "Semifinal 1 (1° vs 4°)",
      stage: "playoff",
      playoffSlot: "sf1",
      homeTeamId: first.teamId,
      awayTeamId: fourth.teamId,
      status: "pendiente",
      events: [],
      createdAt: new Date(now).toISOString(),
    },
    {
      id: `po-sf2-${now + 1}`,
      editionId: "ed-2026",
      round: startRound,
      roundLabel: "Semifinal 2 (2° vs 3°)",
      stage: "playoff",
      playoffSlot: "sf2",
      homeTeamId: second.teamId,
      awayTeamId: third.teamId,
      status: "pendiente",
      events: [],
      createdAt: new Date(now + 1000).toISOString(),
    },
  ];
}

export function generatePlayoffDirectFinal(
  standings: StandingRow[],
  startRound = 101
): Match | null {
  if (standings.length < 2) return null;
  const [first, second] = standings;
  const now = Date.now();

  return {
    id: `po-final-${now}`,
    editionId: "ed-2026",
    round: startRound,
    roundLabel: "Gran Final",
    stage: "playoff",
    playoffSlot: "final",
    homeTeamId: first.teamId,
    awayTeamId: second.teamId,
    status: "pendiente",
    events: [],
    createdAt: new Date(now).toISOString(),
  };
}

/**
 * Generates the official Copa Hostería 4° Edición (28.11.2026) 7-team fixture:
 * ONLY 7 group-stage matches (F1..F7, 2 per team in single table) + SEMI 1 + SEMI 2 + FINAL.
 * Never generates a round-robin (todos contra todos).
 */
export function generateCopaHosteriaFixture(teams: Team[]): Match[] {
  const getTeamId = (idx: number) => teams[idx]?.id ?? `team-${idx + 1}`;

  const now = Date.now();
  const groupSchedule: {
    label: string;
    time: string;
    homeIdx: number;
    awayIdx: number;
  }[] = [
    { label: "F1", time: "15.30 HS", homeIdx: 0, awayIdx: 3 }, // Equipo 1 vs Equipo 4
    { label: "F2", time: "16.00 HS", homeIdx: 1, awayIdx: 6 }, // Equipo 2 vs Equipo 7
    { label: "F3", time: "16.40 HS", homeIdx: 4, awayIdx: 2 }, // Equipo 5 vs Equipo 3
    { label: "F4", time: "17.20 HS", homeIdx: 5, awayIdx: 0 }, // Equipo 6 vs Equipo 1
    { label: "F5", time: "18.00 HS", homeIdx: 3, awayIdx: 1 }, // Equipo 4 vs Equipo 2
    { label: "F6", time: "18.40 HS", homeIdx: 6, awayIdx: 4 }, // Equipo 7 vs Equipo 5
    { label: "F7", time: "19.20 HS", homeIdx: 2, awayIdx: 5 }, // Equipo 3 vs Equipo 6
  ];

  const groupMatches: Match[] = groupSchedule.map((item, idx) => ({
    id: `m-${now}-f${idx + 1}`,
    editionId: "ed-2026",
    round: idx + 1,
    roundLabel: item.label,
    stage: "liga",
    scheduledTime: item.time,
    homeTeamId: getTeamId(item.homeIdx),
    awayTeamId: getTeamId(item.awayIdx),
    status: "pendiente",
    events: [],
    createdAt: new Date(now + idx * 1000).toISOString(),
  }));

  const playoffMatches: Match[] = [
    {
      id: `po-sf1-${now}`,
      editionId: "ed-2026",
      round: 8,
      roundLabel: "SEMI 1",
      stage: "playoff",
      playoffSlot: "sf1",
      scheduledTime: "20.00 HS",
      homeTeamId: "",
      awayTeamId: "",
      homePlaceholder: "1° Zona",
      awayPlaceholder: "4° Zona",
      status: "pendiente",
      events: [],
      createdAt: new Date(now + 8000).toISOString(),
    },
    {
      id: `po-sf2-${now}`,
      editionId: "ed-2026",
      round: 9,
      roundLabel: "SEMI 2",
      stage: "playoff",
      playoffSlot: "sf2",
      scheduledTime: "20.40 HS",
      homeTeamId: "",
      awayTeamId: "",
      homePlaceholder: "2° Zona",
      awayPlaceholder: "3° Zona",
      status: "pendiente",
      events: [],
      createdAt: new Date(now + 9000).toISOString(),
    },
    {
      id: `po-final-${now}`,
      editionId: "ed-2026",
      round: 10,
      roundLabel: "FINAL",
      stage: "playoff",
      playoffSlot: "final",
      scheduledTime: "21.30 HS",
      homeTeamId: "",
      awayTeamId: "",
      homePlaceholder: "Ganador S1",
      awayPlaceholder: "Ganador S2",
      status: "pendiente",
      events: [],
      createdAt: new Date(now + 10000).toISOString(),
    },
  ];

  return [...groupMatches, ...playoffMatches];
}

/**
 * Automatically populates SEMI 1 (1° vs 4°) and SEMI 2 (2° vs 3°) once all group matches
 * are finalized, and populates FINAL (Ganador S1 vs Ganador S2) as semifinals finish.
 */
export function syncPlayoffBracket(teams: Team[], matches: Match[]): Match[] {
  const groupMatches = matches.filter((m) => m.stage !== "playoff");
  const allGroupsFinished =
    groupMatches.length > 0 &&
    groupMatches.every((m) => m.status === "finalizado");

  const standings = calculateStandings(teams, matches);

  const afterSemis = matches.map((m) => {
    if (m.stage !== "playoff") return m;
    if (m.playoffSlot !== "sf1" && m.playoffSlot !== "sf2") return m;
    if (m.status !== "pendiente" || m.events.length > 0) return m;

    if (allGroupsFinished && standings.length >= 4) {
      if (m.playoffSlot === "sf1") {
        return {
          ...m,
          homeTeamId: standings[0].teamId,
          awayTeamId: standings[3].teamId,
        };
      }
      return {
        ...m,
        homeTeamId: standings[1].teamId,
        awayTeamId: standings[2].teamId,
      };
    }

    // If placeholders exist and group stage is not finished yet, keep placeholders
    if (m.homePlaceholder || m.awayPlaceholder) {
      return {
        ...m,
        homeTeamId: "",
        awayTeamId: "",
      };
    }
    return m;
  });

  const sf1 = afterSemis.find(
    (m) => m.stage === "playoff" && m.playoffSlot === "sf1"
  );
  const sf2 = afterSemis.find(
    (m) => m.stage === "playoff" && m.playoffSlot === "sf2"
  );
  const sf1Winner = sf1 ? getMatchWinnerTeamId(sf1) : null;
  const sf2Winner = sf2 ? getMatchWinnerTeamId(sf2) : null;

  return afterSemis.map((m) => {
    if (m.stage !== "playoff" || m.playoffSlot !== "final") return m;
    if (m.status !== "pendiente" || m.events.length > 0) return m;
    if (!m.homePlaceholder && !m.awayPlaceholder) return m;

    return {
      ...m,
      homeTeamId: sf1Winner ?? "",
      awayTeamId: sf2Winner ?? "",
    };
  });
}

function pickRandomGoalCount(): number {
  const pool = [0, 0, 1, 1, 1, 2, 2, 3, 4];
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildSimulatedGoals(
  matchId: string,
  team: Team | undefined,
  teamId: string,
  count: number,
  baseTs: number
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const roster = team?.playerIds ?? [];
  // Prefer outfield players (index >= 1) when roster has > 1, fallback to any
  const scorerPool = roster.length > 1 ? roster.slice(1) : roster;

  for (let i = 0; i < count; i++) {
    const scorerId =
      scorerPool.length > 0
        ? scorerPool[Math.floor(Math.random() * scorerPool.length)]
        : "";
    let assistId: string | null = null;
    if (roster.length > 1 && scorerId && Math.random() < 0.7) {
      const candidates = roster.filter((id) => id !== scorerId);
      if (candidates.length > 0) {
        assistId = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    events.push({
      id: `sim-${matchId}-${teamId}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      matchId,
      teamId,
      playerId: scorerId,
      assistPlayerId: assistId,
      type: "gol",
      createdAt: new Date(baseTs + i * 1000).toISOString(),
    });
  }
  return events;
}

function simulateSingleMatch(
  match: Match,
  teamMap: Map<string, Team>,
  withPenaltiesIfTied: boolean
): Match {
  const homeGoals = pickRandomGoalCount();
  const awayGoals = pickRandomGoalCount();
  const now = Date.now();

  const homeEvents = buildSimulatedGoals(
    match.id,
    teamMap.get(match.homeTeamId),
    match.homeTeamId,
    homeGoals,
    now
  );
  const awayEvents = buildSimulatedGoals(
    match.id,
    teamMap.get(match.awayTeamId),
    match.awayTeamId,
    awayGoals,
    now + 5000
  );

  let penaltiesHome: number | null = null;
  let penaltiesAway: number | null = null;
  if (withPenaltiesIfTied && homeGoals === awayGoals) {
    const winnerSide = Math.random() < 0.5 ? "home" : "away";
    const loserPen = Math.floor(Math.random() * 4) + 1; // 1..4
    const winnerPen = loserPen + 1;
    penaltiesHome = winnerSide === "home" ? winnerPen : loserPen;
    penaltiesAway = winnerSide === "away" ? winnerPen : loserPen;
  }

  return {
    ...match,
    status: "finalizado",
    events: [...homeEvents, ...awayEvents],
    penaltiesHome,
    penaltiesAway,
  };
}

/**
 * Simulates an entire tournament run (F1..F7, SEMI 1, SEMI 2, FINAL) with random
 * goals, assists, and penalties if knockout matches end tied.
 */
export function simulateTournamentMatches(
  teams: Team[],
  existingMatches: Match[]
): { teams: Team[]; matches: Match[] } {
  const cleanTeams = teams.map((t) => ({
    ...t,
    tiebreakOrder: undefined,
  }));
  const teamMap = new Map(cleanTeams.map((t) => [t.id, t]));

  const hasOfficial7 =
    existingMatches.filter((m) => m.stage !== "playoff").length === 7;
  const baseMatches = hasOfficial7
    ? existingMatches.map((m) => ({
        ...m,
        status: "pendiente" as const,
        events: [],
        penaltiesHome: null,
        penaltiesAway: null,
        ...(m.stage === "playoff" && (m.homePlaceholder || m.awayPlaceholder)
          ? { homeTeamId: "", awayTeamId: "" }
          : {}),
      }))
    : generateCopaHosteriaFixture(cleanTeams);

  // 1. Simulate group stage (F1..F7)
  const afterGroups = baseMatches.map((m) =>
    m.stage === "playoff" ? m : simulateSingleMatch(m, teamMap, false)
  );

  // 2. Populate SEMI 1 (1° vs 4°) & SEMI 2 (2° vs 3°)
  const withSemisPopulated = syncPlayoffBracket(cleanTeams, afterGroups);

  // 3. Simulate SEMI 1 & SEMI 2 (with penalties if tied)
  const afterSemis = withSemisPopulated.map((m) => {
    if (m.stage !== "playoff") return m;
    if (m.playoffSlot !== "sf1" && m.playoffSlot !== "sf2") return m;
    if (!m.homeTeamId || !m.awayTeamId) return m;
    return simulateSingleMatch(m, teamMap, true);
  });

  // 4. Populate FINAL (Ganador S1 vs Ganador S2)
  const withFinalPopulated = syncPlayoffBracket(cleanTeams, afterSemis);

  // 5. Simulate FINAL (with penalties if tied)
  const finalMatches = withFinalPopulated.map((m) => {
    if (m.stage !== "playoff" || m.playoffSlot !== "final") return m;
    if (!m.homeTeamId || !m.awayTeamId) return m;
    return simulateSingleMatch(m, teamMap, true);
  });

  return { teams: cleanTeams, matches: finalMatches };
}

export function clearTournamentResults(
  teams: Team[],
  matches: Match[]
): { teams: Team[]; matches: Match[] } {
  const cleanTeams = teams.map((t) => ({
    ...t,
    tiebreakOrder: undefined,
  }));
  const clearedMatches = matches.map((m) => ({
    ...m,
    status: "pendiente" as const,
    events: [],
    penaltiesHome: null,
    penaltiesAway: null,
    ...(m.stage === "playoff" && (m.homePlaceholder || m.awayPlaceholder)
      ? { homeTeamId: "", awayTeamId: "" }
      : {}),
  }));
  return {
    teams: cleanTeams,
    matches: syncPlayoffBracket(cleanTeams, clearedMatches),
  };
}
