import {
  Match,
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
    });
  }

  for (const m of matches) {
    if (m.status === "pendiente") continue;
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
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamName.localeCompare(b.teamName, "es");
  });

  return rows;
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
