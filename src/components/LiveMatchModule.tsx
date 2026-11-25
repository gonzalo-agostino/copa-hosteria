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
  Minus,
  Dices,
  RotateCcw,
  Clock,
} from "lucide-react";
import {
  Match,
  MatchEvent,
  Player,
  Team,
  TournamentDB,
} from "@/types/tournament";
import {
  clearTournamentResults,
  generateCopaHosteriaFixture,
  getMatchScore,
  getMatchWinnerTeamId,
  simulateTournamentMatches,
  syncPlayoffBracket,
} from "@/lib/stats";
import {
  DEFAULT_TEAMS_META,
  OFFICIAL_DRAW_TEAM_COUNT,
  OFFICIAL_PLAYERS_PER_TEAM,
} from "@/lib/seed";
import { downloadFixturePosterPng } from "@/lib/export";
import {
  exportFullFixturePdf,
  exportMatchSheetPdf,
  exportTournamentRulesPdf,
} from "@/lib/exportPdf";
import { formatStars } from "@/lib/utils";
import { TeamBadge } from "@/components/TeamBadge";
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
  onSelectPlayer?: (playerId: string) => void;
}

export function LiveMatchModule({
  db,
  isOrganizer,
  onUpdateDB,
  onSelectPlayer,
}: LiveMatchModuleProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newHomeId, setNewHomeId] = useState<string>(db.teams[0]?.id ?? "");
  const [newAwayId, setNewAwayId] = useState<string>(db.teams[1]?.id ?? "");
  const [newRoundLabel, setNewRoundLabel] = useState("Fecha 1");
  const [newScheduledTime, setNewScheduledTime] = useState("");

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
                imageUrl: existing?.imageUrl ?? null,
                playerIds: existing?.playerIds ?? [],
                captainId: existing?.captainId ?? null,
                dtId: existing?.dtId ?? null,
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

  const handleSimulateTournament = () => {
    onUpdateDB((prev) => {
      const baseTeams: Team[] =
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
                imageUrl: existing?.imageUrl ?? null,
                playerIds: existing?.playerIds ?? [],
                captainId: existing?.captainId ?? null,
                dtId: existing?.dtId ?? null,
                maxPlayers: existing?.maxPlayers ?? OFFICIAL_PLAYERS_PER_TEAM,
              };
            });
      const simulated = simulateTournamentMatches(
        baseTeams,
        prev.matches,
        prev.players
      );
      return {
        ...prev,
        teams: simulated.teams,
        matches: simulated.matches,
      };
    });
  };

  const handleClearResults = () => {
    onUpdateDB((prev) => {
      const cleared = clearTournamentResults(prev.teams, prev.matches);
      return {
        ...prev,
        teams: cleared.teams,
        matches: cleared.matches,
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
      scheduledTime: newScheduledTime.trim() || undefined,
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
    setNewScheduledTime("");
    setCreateOpen(false);
    setSelectedMatchId(match.id);
  };

  const handleUpdateMatchTime = (matchId: string, scheduledTime: string) => {
    onUpdateDB((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        m.id === matchId ? { ...m, scheduledTime } : m
      ),
    }));
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

  const playoffMatches = useMemo(
    () =>
      db.matches
        .filter((m) => m.stage === "playoff")
        .sort((a, b) => a.round - b.round || a.createdAt.localeCompare(b.createdAt)),
    [db.matches]
  );

  const finalMatch =
    playoffMatches.find((m) => m.playoffSlot === "final") ?? null;
  const championTeamId = finalMatch ? getMatchWinnerTeamId(finalMatch) : null;
  const championTeam = championTeamId ? teamMap.get(championTeamId) ?? null : null;

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
                <TeamBadge
                  name={homeTeam?.name ?? "Local"}
                  color={homeTeam?.color ?? "#2563EB"}
                  imageUrl={homeTeam?.imageUrl}
                  size="lg"
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
                {isOrganizer ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#F5CE78]" />
                    <input
                      type="text"
                      aria-label="Horario del partido"
                      value={selectedMatch.scheduledTime ?? ""}
                      onChange={(e) =>
                        handleUpdateMatchTime(selectedMatch.id, e.target.value)
                      }
                      placeholder="Ej: 15.30 HS"
                      className="w-24 rounded-lg border border-[#D49B35]/40 bg-[#071433]/90 px-2 py-0.5 text-center text-xs font-bold text-[#F5CE78] placeholder:text-blue-200/40 focus:border-[#F5CE78] focus:outline-none focus:ring-1 focus:ring-[#F5CE78]"
                    />
                  </div>
                ) : (
                  selectedMatch.scheduledTime && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-[#F5CE78]">
                      <Clock className="h-3 w-3" />
                      {selectedMatch.scheduledTime}
                    </span>
                  )
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
                <TeamBadge
                  name={awayTeam?.name ?? "Visitante"}
                  color={awayTeam?.color ?? "#D49B35"}
                  imageUrl={awayTeam?.imageUrl}
                  size="lg"
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
                          <button
                            type="button"
                            onClick={() =>
                              player && onSelectPlayer?.(player.id)
                            }
                            className="block truncate font-bold text-white hover:text-[#F5CE78] cursor-pointer text-left"
                          >
                            {player?.name ?? "Jugador"}
                          </button>
                          {assist ? (
                            <button
                              type="button"
                              onClick={() => onSelectPlayer?.(assist.id)}
                              className="block text-xs text-blue-200/75 hover:text-[#F5CE78] cursor-pointer text-left"
                            >
                              Asistencia: {assist.name}
                            </button>
                          ) : (
                            <p className="text-xs text-blue-200/75">Gol</p>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-100">
                        <TeamBadge
                          name={team?.name ?? "Equipo"}
                          color={team?.color ?? "#fff"}
                          imageUrl={team?.imageUrl}
                          size="xs"
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
                        <TeamBadge
                          name={team.name}
                          color={team.color}
                          imageUrl={team.imageUrl}
                          size="sm"
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

    const badge = team.imageUrl ? (
      <TeamBadge
        name={team.name}
        color={team.color}
        imageUrl={team.imageUrl}
        size="sm"
      />
    ) : null;

    if (isVeryDarkColor(team.color)) {
      return (
        <span
          className={`inline-flex max-w-full items-center gap-1.5 ${
            align === "right" ? "flex-row-reverse" : ""
          }`}
        >
          {badge}
          <span
            className={`inline-flex max-w-full items-center truncate rounded-lg border border-white/70 bg-[#111827] px-2 py-0.5 text-xs sm:text-sm font-black uppercase tracking-tight text-white shadow-sm ${
              crossed ? "opacity-50 line-through" : ""
            }`}
          >
            {label}
          </span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {badge}
        <span
          className={`truncate text-xs sm:text-sm font-black uppercase tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] ${
            align === "right" ? "text-right" : "text-left"
          } ${crossed ? "opacity-50 line-through" : ""}`}
          style={{ color: team.color }}
        >
          {label}
        </span>
      </span>
    );
  };

  const formatTeamScorers = (match: Match, teamId: string): string => {
    const counts = new Map<string, number>();
    const order: string[] = [];
    for (const ev of match.events) {
      if (ev.type !== "gol" || ev.teamId !== teamId || !ev.playerId) continue;
      if (!counts.has(ev.playerId)) order.push(ev.playerId);
      counts.set(ev.playerId, (counts.get(ev.playerId) ?? 0) + 1);
    }
    return order
      .map((pid) => {
        const name = playerMap.get(pid)?.name ?? "Jugador";
        const c = counts.get(pid) ?? 1;
        return c > 1 ? `${name} ×${c}` : name;
      })
      .join(", ");
  };

  const renderMatchScorersRow = (match: Match) => {
    const homeScorers = formatTeamScorers(match, match.homeTeamId);
    const awayScorers = formatTeamScorers(match, match.awayTeamId);
    const hasPenalties =
      match.stage === "playoff" &&
      match.penaltiesHome != null &&
      match.penaltiesAway != null;

    if (!homeScorers && !awayScorers && !hasPenalties) return null;

    return (
      <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-start gap-2 border-t border-white/10 pt-1.5 text-[10px] sm:text-[11px] text-blue-100/80">
        <div className="text-right truncate" title={homeScorers}>
          {homeScorers ? `⚽ ${homeScorers}` : ""}
        </div>
        <div className="text-center font-bold text-[#F5CE78] whitespace-nowrap">
          {hasPenalties
            ? `(${match.penaltiesHome} - ${match.penaltiesAway} pen.)`
            : ""}
        </div>
        <div className="text-left truncate" title={awayScorers}>
          {awayScorers ? `⚽ ${awayScorers}` : ""}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Champion Banner when Final finishes */}
      {championTeam && (
        <Card className="border-[#F5CE78] bg-gradient-to-b from-[#D49B35]/30 via-[#16357A]/90 to-[#071433]/95 shadow-xl shadow-[#D49B35]/20">
          <CardContent className="flex flex-col items-center p-6 text-center space-y-2.5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#F5CE78] bg-[#D49B35]/25 text-[#F5CE78] shadow-lg">
              <Trophy className="h-9 w-9" />
            </div>
            <Badge variant="gold">★ CAMPEÓN 4° EDICIÓN (2026) ★</Badge>
            <div className="flex items-center gap-2.5">
              <TeamBadge
                name={championTeam.name}
                color={championTeam.color}
                imageUrl={championTeam.imageUrl}
                size="lg"
              />
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {championTeam.name.toUpperCase()}
              </h2>
            </div>
            {championTeam.playerIds.length > 0 && (
              <div className="flex max-w-md flex-wrap justify-center gap-1.5">
                {championTeam.playerIds.map((pid) => {
                  const p = playerMap.get(pid);
                  if (!p) return null;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => onSelectPlayer?.(p.id)}
                      className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-semibold text-blue-100 transition hover:bg-[#D49B35]/30 hover:text-[#F5CE78] cursor-pointer"
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isOrganizer && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
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
                variant="outline"
                onClick={handleSimulateTournament}
                className="w-full border-[#D49B35]/55 text-[#F5CE78] hover:bg-[#D49B35]/15"
              >
                <Dices className="h-4 w-4" />
                Simular Torneo
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
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Button
                size="lg"
                variant="outline"
                onClick={() => downloadFixturePosterPng(db.teams, db.matches)}
                className="w-full border-[#D49B35]/55 text-[#F5CE78] hover:bg-[#D49B35]/15"
              >
                <Download className="h-4 w-4" />
                Placa Fixture (PNG)
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
                Fixture y Planillas (PDF)
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => exportTournamentRulesPdf(db.teams, db.matches)}
                className="w-full"
              >
                <FileDown className="h-4 w-4 text-[#F0C46B]" />
                Reglamento Oficial (PDF)
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
                              className="group rounded-xl border border-[#D49B35]/30 bg-[#10295E]/75 px-2.5 py-2.5 sm:px-3.5 sm:py-3 cursor-pointer transition hover:border-[#F5CE78]/70 hover:bg-[#143478]/85 active:scale-[0.995]"
                            >
                              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
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
                                    {isOrganizer ? (
                                      <input
                                        type="text"
                                        aria-label={`Horario de ${match.roundLabel}`}
                                        value={match.scheduledTime ?? ""}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) =>
                                          handleUpdateMatchTime(
                                            match.id,
                                            e.target.value
                                          )
                                        }
                                        placeholder="HH.MM HS"
                                        className="w-[74px] sm:w-[86px] rounded-lg border border-[#D49B35]/40 bg-[#071433]/90 px-1.5 py-0.5 text-right text-[11px] sm:text-xs font-black tabular-nums text-[#F5CE78] placeholder:text-blue-200/40 focus:border-[#F5CE78] focus:outline-none focus:ring-1 focus:ring-[#F5CE78]"
                                      />
                                    ) : (
                                      match.scheduledTime && (
                                        <span className="text-[11px] sm:text-xs font-black tabular-nums text-[#F5CE78]">
                                          {match.scheduledTime}
                                        </span>
                                      )
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
                              {renderMatchScorersRow(match)}
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
                            className={`rounded-xl px-2.5 py-2.5 sm:px-3.5 sm:py-3 transition ${
                              isReady
                                ? "cursor-pointer active:scale-[0.995]"
                                : "opacity-90"
                            } ${
                              isFinal
                                ? "border-2 border-[#F5CE78]/75 bg-gradient-to-r from-[#D49B35]/20 via-[#15357A]/90 to-[#D49B35]/20 shadow-md shadow-[#D49B35]/15"
                                : "border border-[#F5CE78]/45 bg-[#143275]/80 hover:border-[#F5CE78]/75"
                            }`}
                          >
                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
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
                                  {isOrganizer ? (
                                    <input
                                      type="text"
                                      aria-label={`Horario de ${match.roundLabel}`}
                                      value={match.scheduledTime ?? ""}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        handleUpdateMatchTime(
                                          match.id,
                                          e.target.value
                                        )
                                      }
                                      placeholder="HH.MM HS"
                                      className={`w-[74px] sm:w-[86px] rounded-lg border border-[#D49B35]/45 bg-[#071433]/90 px-1.5 py-0.5 text-right text-[11px] sm:text-xs font-black tabular-nums placeholder:text-blue-200/40 focus:border-[#F5CE78] focus:outline-none focus:ring-1 focus:ring-[#F5CE78] ${
                                        isFinal ? "text-white" : "text-[#F5CE78]"
                                      }`}
                                    />
                                  ) : (
                                    match.scheduledTime && (
                                      <span
                                        className={`text-[11px] sm:text-xs font-black tabular-nums ${
                                          isFinal ? "text-white" : "text-[#F5CE78]"
                                        }`}
                                      >
                                        {match.scheduledTime}
                                      </span>
                                    )
                                  )}
                                  {match.status === "finalizado" && (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                                      FINAL
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {renderMatchScorersRow(match)}
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
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="text-[#F5CE78] hover:bg-[#D49B35]/15"
                onClick={handleClearResults}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Limpiar Resultados (0–0)
              </Button>
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
                Horario (opcional)
              </label>
              <Input
                value={newScheduledTime}
                onChange={(e) => setNewScheduledTime(e.target.value)}
                placeholder="Ej: 16.30 HS"
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
