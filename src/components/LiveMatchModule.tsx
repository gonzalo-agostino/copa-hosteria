"use client";

import React, { useMemo, useState } from "react";
import {
  Plus,
  Undo2,
  Play,
  Flag,
  CalendarPlus,
  ChevronLeft,
  Sparkles,
  Trash2,
  FileDown,
  Download,
  Trophy,
  Swords,
  Minus,
} from "lucide-react";
import {
  Match,
  MatchEvent,
  Player,
  Team,
  TournamentDB,
} from "@/types/tournament";
import {
  calculateStandings,
  generateCopaHosteriaFixture,
  generatePlayoffDirectFinal,
  generatePlayoffSemifinals,
  getMatchLoserTeamId,
  getMatchScore,
  getMatchWinnerTeamId,
  syncPlayoffBracket,
} from "@/lib/stats";
import {
  DEFAULT_TEAMS_META,
  OFFICIAL_DRAW_TEAM_COUNT,
  OFFICIAL_PLAYERS_PER_TEAM,
} from "@/lib/seed";
import { downloadFixturePosterPng } from "@/lib/export";
import { exportFullFixturePdf, exportMatchSheetPdf } from "@/lib/exportPdf";
import { formatStars } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LiveMatchModuleProps {
  db: TournamentDB;
  isOrganizer: boolean;
  onUpdateDB: (updater: (prev: TournamentDB) => TournamentDB) => void;
}

export function LiveMatchModule({
  db,
  isOrganizer,
  onUpdateDB,
}: LiveMatchModuleProps) {
  const [viewMode, setViewMode] = useState<"liga" | "playoff">("liga");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newHomeId, setNewHomeId] = useState<string>(db.teams[0]?.id ?? "");
  const [newAwayId, setNewAwayId] = useState<string>(db.teams[1]?.id ?? "");
  const [newRoundLabel, setNewRoundLabel] = useState("Fecha 1");

  // Live event sheet state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [eventTeamId, setEventTeamId] = useState<string>("");
  const [pendingScorerId, setPendingScorerId] = useState<string | null>(null);

  const teamMap = useMemo(
    () => new Map<string, Team>(db.teams.map((t) => [t.id, t])),
    [db.teams]
  );

  const playerMap = useMemo(
    () => new Map<string, Player>(db.players.map((p) => [p.id, p])),
    [db.players]
  );

  const selectedMatch = useMemo(
    () => db.matches.find((m) => m.id === selectedMatchId) ?? null,
    [db.matches, selectedMatchId]
  );

  const handleGenerateFixture = () => {
    onUpdateDB((prev) => {
      const nextTeams: Team[] =
        prev.teams.length >= OFFICIAL_DRAW_TEAM_COUNT
          ? prev.teams
          : Array.from({ length: OFFICIAL_DRAW_TEAM_COUNT }, (_, i) => {
              const existing = prev.teams[i];
              const preset = DEFAULT_TEAMS_META[i % DEFAULT_TEAMS_META.length];
              return {
                id: existing?.id ?? `team-${i + 1}`,
                editionId: "ed-2026",
                name: existing?.name ?? preset.name,
                color: existing?.color ?? preset.color,
                playerIds: existing?.playerIds ?? [],
                captainId: existing?.captainId ?? null,
                maxPlayers: existing?.maxPlayers ?? OFFICIAL_PLAYERS_PER_TEAM,
              };
            });
      return {
        ...prev,
        teams: nextTeams,
        matches: generateCopaHosteriaFixture(nextTeams),
      };
    });
  };

  const handleCreateCustomMatch = () => {
    if (!newHomeId || !newAwayId || newHomeId === newAwayId) return;
    const nextRoundNum =
      db.matches.reduce((max, m) => Math.max(max, m.round), 0) + 1;
    const match: Match = {
      id: `m-${Date.now()}`,
      editionId: "ed-2026",
      round: nextRoundNum,
      roundLabel: newRoundLabel.trim() || `Fecha ${nextRoundNum}`,
      homeTeamId: newHomeId,
      awayTeamId: newAwayId,
      status: "pendiente",
      events: [],
      createdAt: new Date().toISOString(),
    };
    onUpdateDB((prev) => ({
      ...prev,
      matches: [...prev.matches, match],
    }));
    setCreateOpen(false);
    setSelectedMatchId(match.id);
  };

  const handleDeleteMatch = (matchId: string) => {
    onUpdateDB((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.id !== matchId),
    }));
    if (selectedMatchId === matchId) setSelectedMatchId(null);
  };

  const handleSetMatchStatus = (
    matchId: string,
    status: Match["status"]
  ) => {
    onUpdateDB((prev) => {
      const updated = prev.matches.map((m) =>
        m.id === matchId ? { ...m, status } : m
      );
      return {
        ...prev,
        matches: syncPlayoffBracket(prev.teams, updated),
      };
    });
  };

  const openGoalModal = () => {
    if (!selectedMatch) return;
    setGoalModalOpen(true);
    setEventTeamId(selectedMatch.homeTeamId);
    setPendingScorerId(null);
  };

  const recordGoal = (
    playerId: string,
    assistPlayerId?: string | null
  ) => {
    if (!selectedMatch || !eventTeamId) return;

    const newEvent: MatchEvent = {
      id: `ev-${crypto.randomUUID()}`,
      matchId: selectedMatch.id,
      teamId: eventTeamId,
      playerId,
      assistPlayerId: assistPlayerId ?? null,
      type: "gol",
      createdAt: new Date().toISOString(),
    };

    onUpdateDB((prev) => {
      const updated = prev.matches.map((m) => {
        if (m.id !== selectedMatch.id) return m;
        return {
          ...m,
          status: m.status === "pendiente" ? "en_vivo" : m.status,
          events: [...m.events, newEvent],
        };
      });
      return {
        ...prev,
        matches: syncPlayoffBracket(prev.teams, updated),
      };
    });

    setGoalModalOpen(false);
    setPendingScorerId(null);
  };

  const handleUndoLastEvent = () => {
    if (!selectedMatch || selectedMatch.events.length === 0) return;
    onUpdateDB((prev) => {
      const updated = prev.matches.map((m) =>
        m.id === selectedMatch.id
          ? { ...m, events: m.events.slice(0, -1) }
          : m
      );
      return {
        ...prev,
        matches: syncPlayoffBracket(prev.teams, updated),
      };
    });
  };

  const standings = useMemo(
    () => calculateStandings(db.teams, db.matches),
    [db.teams, db.matches]
  );

  const playoffMatches = useMemo(
    () =>
      db.matches
        .filter((m) => m.stage === "playoff")
        .sort((a, b) => a.round - b.round || a.createdAt.localeCompare(b.createdAt)),
    [db.matches]
  );

  const sf1Match = playoffMatches.find((m) => m.playoffSlot === "sf1") ?? null;
  const sf2Match = playoffMatches.find((m) => m.playoffSlot === "sf2") ?? null;
  const thirdMatch =
    playoffMatches.find((m) => m.playoffSlot === "third") ?? null;
  const finalMatch =
    playoffMatches.find((m) => m.playoffSlot === "final") ?? null;

  const sf1Winner = sf1Match ? getMatchWinnerTeamId(sf1Match) : null;
  const sf2Winner = sf2Match ? getMatchWinnerTeamId(sf2Match) : null;
  const sf1Loser = sf1Match ? getMatchLoserTeamId(sf1Match) : null;
  const sf2Loser = sf2Match ? getMatchLoserTeamId(sf2Match) : null;
  const championTeamId = finalMatch ? getMatchWinnerTeamId(finalMatch) : null;
  const championTeam = championTeamId ? teamMap.get(championTeamId) ?? null : null;

  const handleGenerateSemifinals = () => {
    const semis = generatePlayoffSemifinals(standings);
    if (semis.length === 0) return;
    onUpdateDB((prev) => ({
      ...prev,
      matches: [
        ...prev.matches.filter((m) => m.stage !== "playoff"),
        ...semis,
      ],
    }));
  };

  const handleGenerateDirectFinal = () => {
    const directFinal = generatePlayoffDirectFinal(standings);
    if (!directFinal) return;
    onUpdateDB((prev) => ({
      ...prev,
      matches: [
        ...prev.matches.filter((m) => m.stage !== "playoff"),
        directFinal,
      ],
    }));
  };

  const handleGenerateFinalFromSemis = () => {
    if (!sf1Winner || !sf2Winner) return;
    const newMatches: Match[] = [];

    if (sf1Loser && sf2Loser && !thirdMatch) {
      newMatches.push({
        id: `po-third-${crypto.randomUUID().slice(0, 8)}`,
        editionId: "ed-2026",
        round: 101,
        roundLabel: "3° Puesto",
        stage: "playoff",
        playoffSlot: "third",
        homeTeamId: sf1Loser,
        awayTeamId: sf2Loser,
        status: "pendiente",
        events: [],
        createdAt: new Date().toISOString(),
      });
    }

    if (!finalMatch) {
      newMatches.push({
        id: `po-final-${crypto.randomUUID().slice(0, 8)}`,
        editionId: "ed-2026",
        round: 102,
        roundLabel: "Gran Final",
        stage: "playoff",
        playoffSlot: "final",
        homeTeamId: sf1Winner,
        awayTeamId: sf2Winner,
        status: "pendiente",
        events: [],
        createdAt: new Date().toISOString(),
      });
    }

    if (newMatches.length === 0) return;
    onUpdateDB((prev) => ({
      ...prev,
      matches: [...prev.matches, ...newMatches],
    }));
  };

  const handleClearPlayoffs = () => {
    onUpdateDB((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.stage !== "playoff"),
    }));
  };

  const handleClearLeagueMatches = () => {
    onUpdateDB((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.stage === "playoff"),
    }));
  };

  const handleAdjustPenalties = (
    matchId: string,
    side: "home" | "away",
    delta: number
  ) => {
    onUpdateDB((prev) => {
      const updated = prev.matches.map((m) => {
        if (m.id !== matchId) return m;
        const currHome = m.penaltiesHome ?? 0;
        const currAway = m.penaltiesAway ?? 0;
        return {
          ...m,
          penaltiesHome:
            side === "home" ? Math.max(0, currHome + delta) : currHome,
          penaltiesAway:
            side === "away" ? Math.max(0, currAway + delta) : currAway,
        };
      });
      return {
        ...prev,
        matches: syncPlayoffBracket(prev.teams, updated),
      };
    });
  };

  // Group league matches by roundLabel
  const matchesByRound = useMemo(() => {
    const groups = new Map<string, Match[]>();
    const sorted = [...db.matches]
      .filter((m) => m.stage !== "playoff")
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.createdAt.localeCompare(b.createdAt);
      });
    for (const m of sorted) {
      const list = groups.get(m.roundLabel) ?? [];
      list.push(m);
      groups.set(m.roundLabel, list);
    }
    return Array.from(groups.entries());
  }, [db.matches]);

  // --- DETAIL VIEW: LIVE MATCH SHEET ---
  if (selectedMatch) {
    const homeTeam = teamMap.get(selectedMatch.homeTeamId);
    const awayTeam = teamMap.get(selectedMatch.awayTeamId);
    const score = getMatchScore(selectedMatch);

    const activeEventTeam = teamMap.get(eventTeamId);
    const activeEventPlayers = (activeEventTeam?.playerIds ?? [])
      .map((id) => playerMap.get(id))
      .filter((p): p is Player => Boolean(p));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedMatchId(null);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Volver al Fixture
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportMatchSheetPdf(
                  selectedMatch,
                  db.teams,
                  db.players,
                  db.matches
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF Planillero
            </Button>
            <Badge
              variant={
                selectedMatch.status === "en_vivo"
                  ? "live"
                  : selectedMatch.status === "finalizado"
                    ? "gold"
                    : "muted"
              }
            >
              {selectedMatch.roundLabel} ·{" "}
              {selectedMatch.status === "en_vivo"
                ? "EN VIVO"
                : selectedMatch.status === "finalizado"
                  ? "FINALIZADO"
                  : "PENDIENTE"}
            </Badge>
          </div>
        </div>

        {/* Scoreboard Card */}
        <Card className="border-[#D49B35]/40 bg-gradient-to-b from-[#132E6B]/95 to-[#0A1B42]/95">
          <CardContent className="p-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div className="flex flex-col items-center gap-2">
                <span
                  className="h-9 w-9 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: homeTeam?.color ?? "#2563EB" }}
                />
                <span className="text-sm sm:text-base font-extrabold leading-tight text-white">
                  {homeTeam?.name ?? "Local"}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3 rounded-2xl border border-[#D49B35]/40 bg-[#0A1B42]/90 px-4 py-2.5">
                  <span className="text-4xl sm:text-5xl font-black tabular-nums text-white">
                    {score.home}
                  </span>
                  <span className="text-xl font-bold text-[#D49B35]">-</span>
                  <span className="text-4xl sm:text-5xl font-black tabular-nums text-white">
                    {score.away}
                  </span>
                </div>
                {selectedMatch.stage === "playoff" &&
                  (selectedMatch.penaltiesHome != null ||
                    selectedMatch.penaltiesAway != null) && (
                    <span className="rounded-full bg-[#D49B35]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#F5CE78]">
                      Penales: {selectedMatch.penaltiesHome ?? 0} -{" "}
                      {selectedMatch.penaltiesAway ?? 0}
                    </span>
                  )}
              </div>

              <div className="flex flex-col items-center gap-2">
                <span
                  className="h-9 w-9 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: awayTeam?.color ?? "#D49B35" }}
                />
                <span className="text-sm sm:text-base font-extrabold leading-tight text-white">
                  {awayTeam?.name ?? "Visitante"}
                </span>
              </div>
            </div>

            {/* Penalties Controls for Tied Playoff Match (Organizer) */}
            {isOrganizer &&
              selectedMatch.stage === "playoff" &&
              (score.home === score.away ||
                selectedMatch.penaltiesHome != null ||
                selectedMatch.penaltiesAway != null) && (
                <div className="mt-4 rounded-2xl border border-[#D49B35]/40 bg-[#071433]/80 p-3.5">
                  <p className="mb-2.5 text-center text-xs font-extrabold uppercase tracking-wider text-[#F5CE78]">
                    Definición por Penales (Mata-Mata)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#143275]/50 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAdjustPenalties(selectedMatch.id, "home", -1)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-blue-200 truncate max-w-[80px]">
                          {homeTeam?.name}
                        </p>
                        <p className="text-xl font-black tabular-nums text-[#F5CE78]">
                          {selectedMatch.penaltiesHome ?? 0}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleAdjustPenalties(selectedMatch.id, "home", 1)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D49B35] text-[#071433] font-bold hover:bg-[#E5B049]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#143275]/50 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAdjustPenalties(selectedMatch.id, "away", -1)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-blue-200 truncate max-w-[80px]">
                          {awayTeam?.name}
                        </p>
                        <p className="text-xl font-black tabular-nums text-[#F5CE78]">
                          {selectedMatch.penaltiesAway ?? 0}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleAdjustPenalties(selectedMatch.id, "away", 1)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D49B35] text-[#071433] font-bold hover:bg-[#E5B049]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

            {/* Organizer Match Status Controls */}
            {isOrganizer && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {selectedMatch.status === "pendiente" && (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() =>
                      handleSetMatchStatus(selectedMatch.id, "en_vivo")
                    }
                  >
                    <Play className="h-3.5 w-3.5" />
                    Iniciar Partido
                  </Button>
                )}
                {selectedMatch.status === "en_vivo" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() =>
                      handleSetMatchStatus(selectedMatch.id, "finalizado")
                    }
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Finalizar Partido
                  </Button>
                )}
                {selectedMatch.status === "finalizado" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      handleSetMatchStatus(selectedMatch.id, "en_vivo")
                    }
                  >
                    Reabrir en vivo
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ONE-HANDED LIVE ACTION BUTTONS (Organizer) */}
        {isOrganizer && (
          <Card className="border-[#D49B35]/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[#F0C46B]">
                Planilla Rápida en Vivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Button
                size="xl"
                variant="success"
                onClick={openGoalModal}
                className="w-full h-14 text-base font-extrabold"
              >
                <span className="text-xl">⚽</span>
                <span>+ Cargar Gol</span>
              </Button>

              <Button
                variant="secondary"
                size="default"
                className="w-full"
                disabled={selectedMatch.events.length === 0}
                onClick={handleUndoLastEvent}
              >
                <Undo2 className="h-4 w-4" />
                Deshacer último gol
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Match Events Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Goles del Partido</span>
              <Badge variant="muted">
                {selectedMatch.events.filter((e) => e.type === "gol").length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedMatch.events.filter((e) => e.type === "gol").length === 0 ? (
              <p className="py-6 text-center text-xs text-blue-200/55">
                Todavía no hay goles cargados en este partido.
              </p>
            ) : (
              [...selectedMatch.events]
                .filter((e) => e.type === "gol")
                .reverse()
                .map((ev) => {
                  const player = playerMap.get(ev.playerId);
                  const assist = ev.assistPlayerId
                    ? playerMap.get(ev.assistPlayerId)
                    : null;
                  const team = teamMap.get(ev.teamId);

                  return (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#16357A]/45 px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg">⚽</span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">
                            {player?.name ?? "Jugador"}
                          </p>
                          <p className="text-xs text-blue-200/75">
                            {assist ? `Asistencia: ${assist.name}` : "Gol"}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-100">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-white"
                          style={{ backgroundColor: team?.color ?? "#fff" }}
                        />
                        {team?.name}
                      </span>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>

        {/* Event Recording Modal (Goal + Optional Assist) */}
        <Dialog
          open={goalModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setGoalModalOpen(false);
              setPendingScorerId(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingScorerId
                  ? "⚽ ¿Quién asistió el gol?"
                  : "⚽ Cargar Gol"}
              </DialogTitle>
              <DialogDescription>
                {pendingScorerId
                  ? `Goleador: ${playerMap.get(pendingScorerId)?.name}. Elegí el asistidor o tocá sin asistencia.`
                  : "Elegí el equipo y tocá el jugador."}
              </DialogDescription>
            </DialogHeader>

            {/* Step 2 for Goal: Optional Assist */}
            {pendingScorerId ? (
              <div className="space-y-3">
                <Button
                  size="lg"
                  variant="default"
                  className="w-full"
                  onClick={() => recordGoal(pendingScorerId, null)}
                >
                  Sin asistencia / Jugada individual
                </Button>
                <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                  {activeEventPlayers
                    .filter((p) => p.id !== pendingScorerId)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => recordGoal(pendingScorerId, p.id)}
                        className="flex h-12 items-center justify-between rounded-xl border border-white/12 bg-[#16357A]/70 px-3.5 text-left text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-[#1D4396]"
                      >
                        <span>
                          {p.name}{" "}
                          {p.stars > 0 && (
                            <span className="text-[#D49B35]">
                              {formatStars(p.stars)}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-blue-200/70">
                          Asistió
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Team switcher */}
                <div className="grid grid-cols-2 gap-2">
                  {[homeTeam, awayTeam].map((team) => {
                    if (!team) return null;
                    const active = eventTeamId === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setEventTeamId(team.id)}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition ${
                          active
                            ? "border-[#D49B35] bg-[#D49B35]/20 text-white"
                            : "border-white/12 bg-[#0A1B42]/70 text-blue-200/75"
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="truncate">{team.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Players list */}
                {activeEventPlayers.length === 0 ? (
                  <p className="py-6 text-center text-xs text-blue-200/65">
                    Este equipo aún no tiene jugadores asignados. Realizá el sorteo primero.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                    {activeEventPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPendingScorerId(p.id)}
                        className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-white/12 bg-[#16357A]/70 px-3.5 py-2 text-left text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-[#1D4396]"
                      >
                        <div className="min-w-0">
                          <span className="truncate">{p.name}</span>{" "}
                          {p.stars > 0 && (
                            <span className="text-[#D49B35]">
                              {formatStars(p.stars)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- LIST VIEW: FIXTURE & PLAYOFFS ---
  const isVeryDarkColor = (hex?: string) => {
    if (!hex) return false;
    const clean = hex.replace("#", "").trim();
    if (clean.length !== 6) return false;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 45;
  };

  const renderTeamColorName = (
    team: Team | undefined,
    placeholder: string,
    align: "left" | "right" = "left",
    crossed = false
  ) => {
    const label = team?.name ?? placeholder;
    if (!team) {
      return (
        <span
          className={`truncate text-xs sm:text-sm font-bold italic text-blue-200/70 ${
            align === "right" ? "text-right" : "text-left"
          }`}
        >
          {label}
        </span>
      );
    }

    if (isVeryDarkColor(team.color)) {
      return (
        <span
          className={`inline-flex max-w-full items-center truncate rounded-lg border border-white/70 bg-[#111827] px-2 py-0.5 text-xs sm:text-sm font-black uppercase tracking-tight text-white shadow-sm ${
            crossed ? "opacity-50 line-through" : ""
          }`}
        >
          {label}
        </span>
      );
    }

    return (
      <span
        className={`truncate text-xs sm:text-sm font-black uppercase tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] ${
          align === "right" ? "text-right" : "text-left"
        } ${crossed ? "opacity-50 line-through" : ""}`}
        style={{ color: team.color }}
      >
        {label}
      </span>
    );
  };

  const renderPlayoffCard = (match: Match, highlight = false) => {
    const home = teamMap.get(match.homeTeamId);
    const away = teamMap.get(match.awayTeamId);
    const isReady = Boolean(home && away);
    const score = getMatchScore(match);
    const winnerId = getMatchWinnerTeamId(match);
    const hasPenalties =
      match.penaltiesHome != null || match.penaltiesAway != null;

    return (
      <Card
        key={match.id}
        onClick={() => {
          if (isReady) setSelectedMatchId(match.id);
        }}
        className={`transition ${
          isReady ? "cursor-pointer active:scale-[0.99]" : "opacity-90"
        } ${
          highlight
            ? "border-[#F5CE78]/70 bg-gradient-to-b from-[#173982]/90 to-[#091A42]/95 shadow-lg shadow-[#D49B35]/15"
            : "border-[#D49B35]/35 hover:border-[#F5CE78]/65"
        }`}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#D49B35] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#071433]">
                {match.roundLabel}
              </span>
              {match.scheduledTime && (
                <span className="text-xs font-extrabold text-[#F5CE78]">
                  {match.scheduledTime}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={
                  match.status === "en_vivo"
                    ? "live"
                    : match.status === "finalizado"
                      ? "gold"
                      : "muted"
                }
              >
                {match.status === "en_vivo"
                  ? "● EN VIVO"
                  : match.status === "finalizado"
                    ? "FINAL"
                    : isReady
                      ? "PENDIENTE"
                      : "A DEFINIR"}
              </Badge>
              {isOrganizer && (
                <button
                  type="button"
                  aria-label="Eliminar partido"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMatch(match.id);
                  }}
                  className="rounded-lg p-1 text-blue-200/50 hover:bg-red-500/20 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex items-center justify-end gap-2 min-w-0">
              {renderTeamColorName(
                home,
                match.homePlaceholder ?? "Local",
                "right",
                Boolean(winnerId && winnerId !== match.homeTeamId)
              )}
            </div>

            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-[#071433]/90 px-3 py-1 text-sm sm:text-base font-black tabular-nums text-[#F5CE78]">
                {match.status === "pendiente" && match.events.length === 0
                  ? "V."
                  : `${score.home} - ${score.away}`}
              </div>
              {hasPenalties && (
                <span className="mt-0.5 text-[10px] font-bold text-[#F5CE78]">
                  ({match.penaltiesHome ?? 0} - {match.penaltiesAway ?? 0} pen.)
                </span>
              )}
            </div>

            <div className="flex items-center justify-start gap-2 min-w-0">
              {renderTeamColorName(
                away,
                match.awayPlaceholder ?? "Visitante",
                "left",
                Boolean(winnerId && winnerId !== match.awayTeamId)
              )}
            </div>
          </div>

          {winnerId && (
            <div className="rounded-xl border border-[#D49B35]/35 bg-[#D49B35]/12 px-3 py-1.5 text-center text-xs font-bold text-[#F5CE78]">
              {match.playoffSlot === "final"
                ? `🏆 CAMPEÓN: ${teamMap.get(winnerId)?.name}`
                : match.playoffSlot === "third"
                  ? `🥉 3° PUESTO: ${teamMap.get(winnerId)?.name}`
                  : `✓ Clasifica a la Final: ${teamMap.get(winnerId)?.name}`}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stage Switcher: Fase Liga vs Playoffs (Mata-Mata) */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/14 bg-[#071433]/85 p-1.5 shadow-inner shadow-black/20">
        <button
          type="button"
          onClick={() => setViewMode("liga")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
            viewMode === "liga"
              ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-sm shadow-[#D49B35]/25"
              : "text-blue-100/80 hover:bg-white/8 hover:text-white"
          }`}
        >
          <CalendarPlus className="h-4 w-4 shrink-0" />
          <span>Fase Liga ({db.matches.filter((m) => m.stage !== "playoff").length})</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode("playoff")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
            viewMode === "playoff"
              ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-sm shadow-[#D49B35]/25"
              : "text-blue-100/80 hover:bg-white/8 hover:text-white"
          }`}
        >
          <Swords className="h-4 w-4 shrink-0" />
          <span>Playoffs · Mata-Mata</span>
        </button>
      </div>

      {/* PLAYOFFS VIEW */}
      {viewMode === "playoff" ? (
        <div className="space-y-4">
          {/* Champion Banner */}
          {championTeam && (
            <Card className="border-[#F5CE78] bg-gradient-to-b from-[#D49B35]/30 via-[#16357A]/90 to-[#071433]/95 shadow-xl shadow-[#D49B35]/20">
              <CardContent className="flex flex-col items-center p-6 text-center space-y-2.5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#F5CE78] bg-[#D49B35]/25 text-[#F5CE78] shadow-lg">
                  <Trophy className="h-9 w-9" />
                </div>
                <Badge variant="gold">★ CAMPEÓN 4° EDICIÓN (2026) ★</Badge>
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-5 w-5 rounded-full border-2 border-white"
                    style={{ backgroundColor: championTeam.color }}
                  />
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {championTeam.name.toUpperCase()}
                  </h2>
                </div>
                {championTeam.playerIds.length > 0 && (
                  <p className="max-w-md text-xs text-blue-100/85 leading-relaxed">
                    {championTeam.playerIds
                      .map((pid) => playerMap.get(pid)?.name)
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Organizer Playoff Generator Controls */}
          {isOrganizer && playoffMatches.length === 0 && (
            <Card className="border-[#D49B35]/35">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Swords className="h-4 w-4 text-[#F5CE78]" />
                  Armar Playoffs Mata-Mata desde la Tabla
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-blue-100/80">
                  Los cruces se generan automáticamente según las posiciones actuales de la Fase Liga (si empatan en el mata-mata, se define por penales dentro de la planilla).
                </p>

                {standings.length >= 4 && (
                  <div className="rounded-xl border border-white/10 bg-[#071433]/75 p-3 text-xs space-y-1">
                    <p className="font-bold text-[#F5CE78]">
                      Cruces proyectados (Top 4):
                    </p>
                    <p className="text-white/90">
                      • <strong>Semifinal 1:</strong> 1° {standings[0].teamName}{" "}
                      vs 4° {standings[3].teamName}
                    </p>
                    <p className="text-white/90">
                      • <strong>Semifinal 2:</strong> 2° {standings[1].teamName}{" "}
                      vs 3° {standings[2].teamName}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Button
                    size="lg"
                    onClick={handleGenerateSemifinals}
                    disabled={standings.length < 4}
                    className="w-full"
                  >
                    <Trophy className="h-4 w-4" />
                    Generar Semifinales (Top 4)
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={handleGenerateDirectFinal}
                    disabled={standings.length < 2}
                    className="w-full"
                  >
                    <Swords className="h-4 w-4" />
                    Generar Final Directa (1° vs 2°)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bracket Display */}
          {playoffMatches.length === 0 ? (
            !isOrganizer && (
              <Card className="border-[#D49B35]/30">
                <CardContent className="flex flex-col items-center py-12 text-center space-y-2.5">
                  <Trophy className="h-10 w-10 text-[#F5CE78]/80" />
                  <p className="text-base font-extrabold text-white">
                    Playoffs Mata-Mata
                  </p>
                  <p className="max-w-sm text-xs text-blue-100/75">
                    Al finalizar la Fase Liga, aquí se mostrarán las Semifinales, el 3° Puesto y la Gran Final de la Copa Hostería.
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            <div className="space-y-4">
              {/* Semifinals */}
              {(sf1Match || sf2Match) && (
                <div className="space-y-2.5">
                  <h3 className="px-1 text-xs font-extrabold uppercase tracking-widest text-[#F5CE78]">
                    Semifinales · Mata-Mata
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sf1Match && renderPlayoffCard(sf1Match)}
                    {sf2Match && renderPlayoffCard(sf2Match)}
                  </div>
                </div>
              )}

              {/* Button to advance winners to Final & 3rd place */}
              {isOrganizer &&
                sf1Winner &&
                sf2Winner &&
                (!finalMatch || !thirdMatch) && (
                  <Button
                    size="xl"
                    onClick={handleGenerateFinalFromSemis}
                    className="w-full"
                  >
                    <Trophy className="h-5 w-5" />
                    Crear Gran Final y 3° Puesto con los clasificados
                  </Button>
                )}

              {/* Gran Final & 3rd Place */}
              {(finalMatch || thirdMatch) && (
                <div className="space-y-2.5">
                  <h3 className="px-1 text-xs font-extrabold uppercase tracking-widest text-[#F5CE78]">
                    Definición del Torneo
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {finalMatch && renderPlayoffCard(finalMatch, true)}
                    {thirdMatch && renderPlayoffCard(thirdMatch)}
                  </div>
                </div>
              )}

              {/* Extra playoff matches if any */}
              {playoffMatches
                .filter(
                  (m) =>
                    !["sf1", "sf2", "third", "final"].includes(
                      m.playoffSlot ?? ""
                    )
                )
                .map((m) => renderPlayoffCard(m))}

              {isOrganizer && (
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-300 hover:bg-red-500/15 hover:text-red-200"
                    onClick={handleClearPlayoffs}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Reiniciar Playoffs
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {isOrganizer && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Button
                size="lg"
                onClick={handleGenerateFixture}
                className="w-full"
              >
                <Sparkles className="h-4 w-4" />
                Generar Fixture
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  setNewHomeId(db.teams[0]?.id ?? "");
                  setNewAwayId(db.teams[1]?.id ?? "");
                  setCreateOpen(true);
                }}
                className="w-full"
              >
                <CalendarPlus className="h-4 w-4" />
                + Nuevo Partido
              </Button>
            </div>
          )}

          {db.matches.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Button
                size="lg"
                variant="outline"
                onClick={() => downloadFixturePosterPng(db.teams, db.matches)}
                className="w-full border-[#D49B35]/55 text-[#F5CE78] hover:bg-[#D49B35]/15"
              >
                <Download className="h-4 w-4" />
                Descargar Placa Fixture (PNG)
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() =>
                  exportFullFixturePdf(db.teams, db.players, db.matches)
                }
                className="w-full"
              >
                <FileDown className="h-4 w-4 text-[#F0C46B]" />
                Exportar Fixture y Planillas (PDF)
              </Button>
            </div>
          )}

          {db.matches.length === 0 ? (
            <Card className="border-[#D49B35]/30">
              <CardContent className="flex flex-col items-center py-12 sm:py-14 text-center space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D49B35]/40 bg-[#D49B35]/15 text-[#F5CE78] shadow-md shadow-[#D49B35]/10">
                  <CalendarPlus className="h-7 w-7" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-base sm:text-lg font-extrabold text-white">
                    Aún no hay partidos programados
                  </p>
                  <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
                    {isOrganizer
                      ? "Presioná \"Generar Fixture Oficial\" para armar F1 a F7, Semifinales y Final con los horarios oficiales."
                      : "Cuando el organizador genere el fixture de la 4° Edición, aparecerá aquí."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-[#D49B35]/45 bg-gradient-to-b from-[#0F2557]/95 via-[#0A1B42]/95 to-[#071433]/98 shadow-xl shadow-black/30">
              <CardHeader className="border-b border-[#D49B35]/30 bg-[#071433]/70 pb-3">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm sm:text-base">
                  <span className="font-black tracking-wide text-white">
                    FIXTURE OFICIAL · 4° EDICIÓN (28.11.2026)
                  </span>
                  <Badge variant="gold">
                    {db.matches.filter((m) => m.status === "finalizado").length}{" "}
                    / {db.matches.length} jugados
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-4">
                {/* Fase de Grupos (F1..F7) */}
                {matchesByRound.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-[#F5CE78]">
                        Fase de Grupos · Tabla Única
                      </h3>
                      <span className="text-[11px] font-semibold text-blue-200/70">
                        2 partidos por equipo
                      </span>
                    </div>

                    <div className="space-y-2">
                      {matchesByRound.flatMap(([, roundMatches]) =>
                        roundMatches.map((match) => {
                          const home = teamMap.get(match.homeTeamId);
                          const away = teamMap.get(match.awayTeamId);
                          const score = getMatchScore(match);
                          const hasScore =
                            match.status !== "pendiente" ||
                            match.events.length > 0;

                          return (
                            <div
                              key={match.id}
                              onClick={() => setSelectedMatchId(match.id)}
                              className="group grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3 rounded-xl border border-[#D49B35]/30 bg-[#10295E]/75 px-2.5 py-2.5 sm:px-3.5 sm:py-3 cursor-pointer transition hover:border-[#F5CE78]/70 hover:bg-[#143478]/85 active:scale-[0.995]"
                            >
                              {/* Left: Instance label */}
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex min-w-[46px] sm:min-w-[56px] justify-center rounded-lg bg-[#D49B35] px-2 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#071433] shadow-sm">
                                  {match.roundLabel}
                                </span>
                                {match.status === "en_vivo" && (
                                  <span
                                    title="En vivo"
                                    className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"
                                  />
                                )}
                              </div>

                              {/* Center: Team A V. Team B */}
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2.5 min-w-0">
                                <div className="flex justify-end min-w-0">
                                  {renderTeamColorName(home, "Local", "right")}
                                </div>
                                <span className="rounded-md bg-[#071433]/90 px-2 py-0.5 text-[11px] sm:text-xs font-black tabular-nums text-[#F5CE78] border border-[#D49B35]/30">
                                  {hasScore
                                    ? `${score.home} - ${score.away}`
                                    : "V."}
                                </span>
                                <div className="flex justify-start min-w-0">
                                  {renderTeamColorName(
                                    away,
                                    "Visitante",
                                    "left"
                                  )}
                                </div>
                              </div>

                              {/* Right: Time & Status */}
                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <div className="flex flex-col items-end">
                                  {match.scheduledTime && (
                                    <span className="text-[11px] sm:text-xs font-black tabular-nums text-[#F5CE78]">
                                      {match.scheduledTime}
                                    </span>
                                  )}
                                  {match.status === "finalizado" && (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                                      FINAL
                                    </span>
                                  )}
                                  {match.status === "en_vivo" && (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-red-400">
                                      EN VIVO
                                    </span>
                                  )}
                                </div>
                                {isOrganizer && (
                                  <button
                                    type="button"
                                    aria-label="Eliminar partido"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMatch(match.id);
                                    }}
                                    className="rounded-lg p-1 text-blue-200/45 hover:bg-red-500/20 hover:text-red-300"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Fase Final (SEMI 1, SEMI 2, FINAL) */}
                {playoffMatches.length > 0 && (
                  <div className="space-y-2 border-t border-[#D49B35]/30 pt-3.5">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-[#F5CE78]">
                        Fase Final · Cruces Automáticos
                      </h3>
                      <span className="text-[11px] font-semibold text-blue-200/70">
                        Top 4 de la tabla
                      </span>
                    </div>

                    <div className="space-y-2">
                      {playoffMatches.map((match) => {
                        const home = teamMap.get(match.homeTeamId);
                        const away = teamMap.get(match.awayTeamId);
                        const isReady = Boolean(home && away);
                        const isFinal = match.playoffSlot === "final";
                        const score = getMatchScore(match);
                        const hasScore =
                          match.status !== "pendiente" ||
                          match.events.length > 0;

                        return (
                          <div
                            key={match.id}
                            onClick={() => {
                              if (isReady) setSelectedMatchId(match.id);
                            }}
                            className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3 rounded-xl px-2.5 py-2.5 sm:px-3.5 sm:py-3 transition ${
                              isReady
                                ? "cursor-pointer active:scale-[0.995]"
                                : "opacity-90"
                            } ${
                              isFinal
                                ? "border-2 border-[#F5CE78]/75 bg-gradient-to-r from-[#D49B35]/20 via-[#15357A]/90 to-[#D49B35]/20 shadow-md shadow-[#D49B35]/15"
                                : "border border-[#F5CE78]/45 bg-[#143275]/80 hover:border-[#F5CE78]/75"
                            }`}
                          >
                            {/* Left: SEMI 1 / SEMI 2 / FINAL */}
                            <span
                              className={`inline-flex min-w-[64px] sm:min-w-[74px] justify-center rounded-lg px-2 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#071433] shadow-sm ${
                                isFinal ? "bg-[#F5CE78]" : "bg-[#D49B35]"
                              }`}
                            >
                              {match.roundLabel}
                            </span>

                            {/* Center: Team A V. Team B */}
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2.5 min-w-0">
                              <div className="flex justify-end min-w-0">
                                {renderTeamColorName(
                                  home,
                                  match.homePlaceholder ?? "Por definir",
                                  "right"
                                )}
                              </div>
                              <span className="rounded-md bg-[#071433]/90 px-2 py-0.5 text-[11px] sm:text-xs font-black tabular-nums text-[#F5CE78] border border-[#D49B35]/35">
                                {hasScore
                                  ? `${score.home} - ${score.away}`
                                  : "V."}
                              </span>
                              <div className="flex justify-start min-w-0">
                                {renderTeamColorName(
                                  away,
                                  match.awayPlaceholder ?? "Por definir",
                                  "left"
                                )}
                              </div>
                            </div>

                            {/* Right: Time */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="flex flex-col items-end">
                                {match.scheduledTime && (
                                  <span
                                    className={`text-[11px] sm:text-xs font-black tabular-nums ${
                                      isFinal ? "text-white" : "text-[#F5CE78]"
                                    }`}
                                  >
                                    {match.scheduledTime}
                                  </span>
                                )}
                                {match.status === "finalizado" && (
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                                    FINAL
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isOrganizer && db.matches.length > 0 && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="text-red-300 hover:bg-red-500/15 hover:text-red-200"
                onClick={handleClearLeagueMatches}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reiniciar Fase Liga
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Custom Match Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#D49B35]" />
              Crear Partido
            </DialogTitle>
            <DialogDescription>
              Agregá una fecha, semifinal o final al fixture.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-blue-200">
                Instancia / Fecha
              </label>
              <Input
                value={newRoundLabel}
                onChange={(e) => setNewRoundLabel(e.target.value)}
                placeholder="Ej: Fecha 1, Semifinal, Final"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-blue-200">
                Equipo Local
              </label>
              <select
                value={newHomeId}
                onChange={(e) => setNewHomeId(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0A1B42] px-3 text-sm text-white"
              >
                {db.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-blue-200">
                Equipo Visitante
              </label>
              <select
                value={newAwayId}
                onChange={(e) => setNewAwayId(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0A1B42] px-3 text-sm text-white"
              >
                {db.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!newHomeId || !newAwayId || newHomeId === newAwayId}
              onClick={handleCreateCustomMatch}
            >
              Crear y Abrir Planilla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
