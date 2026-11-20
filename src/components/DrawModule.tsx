"use client";

import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Shuffle,
  RotateCcw,
  ArrowLeftRight,
  Copy,
  Download,
  Check,
  Users,
  SlidersHorizontal,
  Dices,
  Lock,
  GripVertical,
  FileDown,
  Undo2,
  Plus,
  Minus,
} from "lucide-react";
import { Player, Team, TournamentDB } from "@/types/tournament";
import {
  buildSuggestedPots,
  DEFAULT_TEAMS_META,
  TEAM_COLOR_PRESETS,
} from "@/lib/seed";
import {
  buildWhatsAppTeamsText,
  downloadPlayerCardPng,
  downloadTeamsPosterPng,
} from "@/lib/export";
import { exportTeamsSheetPdf } from "@/lib/exportPdf";
import { formatStars } from "@/lib/utils";
import { PlayerAvatar } from "@/components/PlayerAvatar";
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

interface DrawModuleProps {
  db: TournamentDB;
  isOrganizer: boolean;
  onUpdateDB: (updater: (prev: TournamentDB) => TournamentDB) => void;
  onRequestOrganizer: () => void;
}

type DrawStep = "bolillero" | "bombos" | "equipos";

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getTeamCapacity(
  team: Team,
  teamCount: number,
  activePlayersCount: number
): number {
  if (typeof team.maxPlayers === "number" && team.maxPlayers >= 1) {
    return team.maxPlayers;
  }
  return Math.max(1, Math.ceil(activePlayersCount / Math.max(1, teamCount)));
}

function pickTargetTeamIndex(
  teams: Team[],
  potOrder: number[],
  offset: number,
  activePlayersCount: number
): number {
  const n = teams.length;
  // First pass: follow shuffled pot order, skipping teams already at capacity
  for (let step = 0; step < n; step++) {
    const idx = potOrder[(offset + step) % n];
    const team = teams[idx];
    const cap = getTeamCapacity(team, n, activePlayersCount);
    if (team.playerIds.length < cap) {
      return idx;
    }
  }
  // Fallback if all teams reached configured capacity: pick team with fewest players
  let bestIdx = 0;
  for (let i = 1; i < n; i++) {
    if (teams[i].playerIds.length < teams[bestIdx].playerIds.length) {
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function DrawModule({
  db,
  isOrganizer,
  onUpdateDB,
  onRequestOrganizer,
}: DrawModuleProps) {
  const [step, setStep] = useState<DrawStep>("bolillero");
  const [isSpinning, setIsSpinning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapA, setSwapA] = useState<string>("");
  const [swapB, setSwapB] = useState<string>("");
  const [draggedPlayer, setDraggedPlayer] = useState<{
    playerId: string;
    fromPotIndex: number;
  } | null>(null);

  const playerMap = useMemo(
    () => new Map<string, Player>(db.players.map((p) => [p.id, p])),
    [db.players]
  );

  const activePlayersCount = useMemo(
    () => db.players.filter((p) => p.convocadoActual).length,
    [db.players]
  );

  const totalDrawn = db.draw.drawnPlayerIds.length;
  const remainingTotal = Math.max(0, activePlayersCount - totalDrawn);

  // Determine the next pot that still has undrawn players
  const activePotIndex = useMemo(() => {
    const drawnSet = new Set(db.draw.drawnPlayerIds);
    const idx = db.draw.pots.findIndex((pot) =>
      pot.playerIds.some((pid) => !drawnSet.has(pid))
    );
    return idx;
  }, [db.draw.pots, db.draw.drawnPlayerIds]);

  const activePot = activePotIndex >= 0 ? db.draw.pots[activePotIndex] : null;
  const activePotRemaining = useMemo(() => {
    if (!activePot) return [];
    const drawnSet = new Set(db.draw.drawnPlayerIds);
    return activePot.playerIds.filter((pid) => !drawnSet.has(pid));
  }, [activePot, db.draw.drawnPlayerIds]);

  const handleChangeTeamCount = (newCount: number) => {
    const clamped = Math.max(4, Math.min(8, newCount));
    onUpdateDB((prev) => {
      const nextTeams: Team[] = Array.from({ length: clamped }, (_, i) => {
        const existing = prev.teams[i];
        const preset = DEFAULT_TEAMS_META[i % DEFAULT_TEAMS_META.length];
        return {
          id: existing?.id ?? `team-${i + 1}`,
          editionId: "ed-2026",
          name: existing?.name ?? preset.name,
          color: existing?.color ?? preset.color,
          playerIds: [],
        };
      });

      return {
        ...prev,
        teams: nextTeams,
        draw: {
          teamCount: clamped,
          pots: buildSuggestedPots(prev.players, clamped),
          drawnPlayerIds: [],
          currentPotIndex: 0,
          potTeamOrders: {},
          isComplete: false,
          lastDrawn: null,
        },
      };
    });
  };

  const handleUpdateTeam = (
    teamId: string,
    patch: Partial<Pick<Team, "name" | "color" | "maxPlayers">>
  ) => {
    onUpdateDB((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)),
    }));
  };

  const handleSuggestPots = () => {
    onUpdateDB((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => ({ ...t, playerIds: [], captainId: null })),
      draw: {
        ...prev.draw,
        pots: buildSuggestedPots(prev.players, prev.teams.length),
        drawnPlayerIds: [],
        currentPotIndex: 0,
        potTeamOrders: {},
        isComplete: false,
        lastDrawn: null,
      },
    }));
  };

  const handleMovePlayerToPot = (
    playerId: string,
    fromPotIndex: number,
    toPotIndex: number
  ) => {
    if (fromPotIndex === toPotIndex) return;
    onUpdateDB((prev) => {
      const nextPots = prev.draw.pots.map((pot, idx) => {
        if (idx === fromPotIndex) {
          return {
            ...pot,
            playerIds: pot.playerIds.filter((id) => id !== playerId),
          };
        }
        if (idx === toPotIndex) {
          return {
            ...pot,
            playerIds: [...pot.playerIds, playerId],
          };
        }
        return pot;
      });
      return {
        ...prev,
        draw: {
          ...prev.draw,
          pots: nextPots,
        },
      };
    });
  };

  const handleToggleCaptain = (teamId: string, playerId: string) => {
    onUpdateDB((prev) => ({
      ...prev,
      teams: prev.teams.map((t) =>
        t.id === teamId
          ? { ...t, captainId: t.captainId === playerId ? null : playerId }
          : t
      ),
    }));
  };

  const handleUndoLastBall = () => {
    if (isSpinning || db.draw.drawnPlayerIds.length === 0) return;
    onUpdateDB((prev) => {
      if (prev.draw.drawnPlayerIds.length === 0) return prev;
      const lastPlayerId =
        prev.draw.drawnPlayerIds[prev.draw.drawnPlayerIds.length - 1];
      const nextDrawn = prev.draw.drawnPlayerIds.slice(0, -1);

      const nextTeams = prev.teams.map((t) => ({
        ...t,
        playerIds: t.playerIds.filter((pid) => pid !== lastPlayerId),
        captainId: t.captainId === lastPlayerId ? null : t.captainId,
      }));

      // Compute previous lastDrawn banner (if any players remain drawn)
      let nextLastDrawn: TournamentDB["draw"]["lastDrawn"] = null;
      if (nextDrawn.length > 0) {
        const prevPlayerId = nextDrawn[nextDrawn.length - 1];
        const prevTeam = nextTeams.find((t) =>
          t.playerIds.includes(prevPlayerId)
        );
        const prevPot = prev.draw.pots.find((pot) =>
          pot.playerIds.includes(prevPlayerId)
        );
        if (prevTeam) {
          nextLastDrawn = {
            playerId: prevPlayerId,
            teamId: prevTeam.id,
            potNumber: prevPot?.number ?? 1,
          };
        }
      }

      const drawnSet = new Set(nextDrawn);
      const nextPotIdx = prev.draw.pots.findIndex((pot) =>
        pot.playerIds.some((pid) => !drawnSet.has(pid))
      );

      return {
        ...prev,
        teams: nextTeams,
        draw: {
          ...prev.draw,
          drawnPlayerIds: nextDrawn,
          currentPotIndex: nextPotIdx >= 0 ? nextPotIdx : 0,
          isComplete: false,
          lastDrawn: nextLastDrawn,
        },
      };
    });
  };

  const handleResetDraw = () => {
    onUpdateDB((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => ({ ...t, playerIds: [], captainId: null })),
      draw: {
        ...prev.draw,
        drawnPlayerIds: [],
        currentPotIndex: 0,
        potTeamOrders: {},
        isComplete: false,
        lastDrawn: null,
      },
    }));
  };

  const drawOneBallNow = () => {
    onUpdateDB((prev) => {
      const drawnSet = new Set(prev.draw.drawnPlayerIds);
      const potIdx = prev.draw.pots.findIndex((pot) =>
        pot.playerIds.some((pid) => !drawnSet.has(pid))
      );
      if (potIdx === -1) {
        return {
          ...prev,
          draw: { ...prev.draw, isComplete: true },
        };
      }

      const pot = prev.draw.pots[potIdx];
      const undrawnInPot = pot.playerIds.filter((pid) => !drawnSet.has(pid));
      const pickedPlayerId =
        undrawnInPot[Math.floor(Math.random() * undrawnInPot.length)];

      // Determine shuffled team assignment order for this pot
      const potOrders = { ...prev.draw.potTeamOrders };
      if (!potOrders[potIdx] || potOrders[potIdx].length !== prev.teams.length) {
        potOrders[potIdx] = shuffleArray(
          Array.from({ length: prev.teams.length }, (_, i) => i)
        );
      }

      const alreadyDrawnFromThisPot =
        pot.playerIds.length - undrawnInPot.length;
      const allActiveIds = prev.players
        .filter((p) => p.convocadoActual)
        .map((p) => p.id);
      const targetTeamIdx = pickTargetTeamIndex(
        prev.teams,
        potOrders[potIdx],
        alreadyDrawnFromThisPot,
        allActiveIds.length
      );
      const targetTeam = prev.teams[targetTeamIdx];

      const nextDrawn = [...prev.draw.drawnPlayerIds, pickedPlayerId];
      const nextTeams = prev.teams.map((t, i) =>
        i === targetTeamIdx
          ? { ...t, playerIds: [...t.playerIds, pickedPlayerId] }
          : t
      );

      const isComplete = nextDrawn.length >= allActiveIds.length;

      return {
        ...prev,
        teams: nextTeams,
        draw: {
          ...prev.draw,
          drawnPlayerIds: nextDrawn,
          currentPotIndex: potIdx,
          potTeamOrders: potOrders,
          isComplete,
          lastDrawn: {
            playerId: pickedPlayerId,
            teamId: targetTeam.id,
            potNumber: pot.number,
          },
        },
      };
    });
  };

  const handleDrawSingleWithAnimation = () => {
    if (isSpinning || remainingTotal === 0) return;
    setIsSpinning(true);
    setTimeout(() => {
      drawOneBallNow();
      setIsSpinning(false);
    }, 850);
  };

  const handleQuickDraw = () => {
    if (isSpinning || remainingTotal === 0) return;
    onUpdateDB((prev) => {
      const drawnSet = new Set(prev.draw.drawnPlayerIds);
      const nextTeams = prev.teams.map((t) => ({
        ...t,
        playerIds: [...t.playerIds],
      }));
      const potOrders = { ...prev.draw.potTeamOrders };
      const nextDrawn = [...prev.draw.drawnPlayerIds];
      let lastDrawn = prev.draw.lastDrawn ?? null;

      prev.draw.pots.forEach((pot, potIdx) => {
        const undrawnInPot = shuffleArray(
          pot.playerIds.filter((pid) => !drawnSet.has(pid))
        );
        if (undrawnInPot.length === 0) return;

        if (!potOrders[potIdx] || potOrders[potIdx].length !== nextTeams.length) {
          potOrders[potIdx] = shuffleArray(
            Array.from({ length: nextTeams.length }, (_, i) => i)
          );
        }

        const alreadyDrawnCount = pot.playerIds.length - undrawnInPot.length;
        const activeCount = prev.players.filter((p) => p.convocadoActual).length;
        undrawnInPot.forEach((pid, k) => {
          const teamIdx = pickTargetTeamIndex(
            nextTeams,
            potOrders[potIdx],
            alreadyDrawnCount + k,
            activeCount
          );
          nextTeams[teamIdx].playerIds.push(pid);
          nextDrawn.push(pid);
          drawnSet.add(pid);
          lastDrawn = {
            playerId: pid,
            teamId: nextTeams[teamIdx].id,
            potNumber: pot.number,
          };
        });
      });

      return {
        ...prev,
        teams: nextTeams,
        draw: {
          ...prev.draw,
          drawnPlayerIds: nextDrawn,
          potTeamOrders: potOrders,
          isComplete: true,
          lastDrawn,
        },
      };
    });
  };

  const handleSwapPlayers = () => {
    if (!swapA || !swapB || swapA === swapB) return;
    onUpdateDB((prev) => {
      let teamAIdx = -1;
      let teamBIdx = -1;
      prev.teams.forEach((t, idx) => {
        if (t.playerIds.includes(swapA)) teamAIdx = idx;
        if (t.playerIds.includes(swapB)) teamBIdx = idx;
      });
      if (teamAIdx === -1 || teamBIdx === -1 || teamAIdx === teamBIdx) {
        return prev;
      }

      const nextTeams = prev.teams.map((t, idx) => {
        if (idx === teamAIdx) {
          return {
            ...t,
            playerIds: t.playerIds.map((id) => (id === swapA ? swapB : id)),
            captainId: t.captainId === swapA ? null : t.captainId,
          };
        }
        if (idx === teamBIdx) {
          return {
            ...t,
            playerIds: t.playerIds.map((id) => (id === swapB ? swapA : id)),
            captainId: t.captainId === swapB ? null : t.captainId,
          };
        }
        return t;
      });

      return { ...prev, teams: nextTeams };
    });

    setSwapA("");
    setSwapB("");
    setSwapOpen(false);
  };

  const handleCopyWhatsApp = async () => {
    const text = buildWhatsAppTeamsText(db.teams, db.players);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const lastDrawnPlayer = db.draw.lastDrawn
    ? playerMap.get(db.draw.lastDrawn.playerId)
    : null;
  const lastDrawnTeam = db.draw.lastDrawn
    ? db.teams.find((t) => t.id === db.draw.lastDrawn?.teamId)
    : null;

  return (
    <div className="space-y-4">
      {/* Sub-navigation for Organizer */}
      {isOrganizer && (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#0A1B42]/75 p-1.5">
          <button
            type="button"
            onClick={() => setStep("bolillero")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition ${
              step === "bolillero"
                ? "bg-[#D49B35] text-[#0A1B42] shadow"
                : "text-blue-200/80 hover:text-white"
            }`}
          >
            <Dices className="h-4 w-4" />
            Bolillero
          </button>
          <button
            type="button"
            onClick={() => setStep("bombos")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition ${
              step === "bombos"
                ? "bg-[#D49B35] text-[#0A1B42] shadow"
                : "text-blue-200/80 hover:text-white"
            }`}
          >
            <Users className="h-4 w-4" />
            Bombos ({db.draw.pots.length})
          </button>
          <button
            type="button"
            onClick={() => setStep("equipos")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition ${
              step === "equipos"
                ? "bg-[#D49B35] text-[#0A1B42] shadow"
                : "text-blue-200/80 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Equipos ({db.teams.length})
          </button>
        </div>
      )}

      {/* STEP: EQUIPOS & CONFIG (Organizer only) */}
      {isOrganizer && step === "equipos" && (() => {
        const totalCapacity = db.teams.reduce(
          (sum, t) => sum + getTeamCapacity(t, db.teams.length, activePlayersCount),
          0
        );
        return (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Configuración de Equipos</span>
              <Badge
                variant={
                  totalCapacity === activePlayersCount ? "gold" : "warning"
                }
              >
                Cupo total: {totalCapacity} / {activePlayersCount} convocados
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-200/75">
                Cantidad de equipos
              </p>
              <div className="grid grid-cols-5 gap-2">
                {[4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleChangeTeamCount(n)}
                    className={`h-11 rounded-xl border text-sm font-bold transition ${
                      db.teams.length === n
                        ? "border-[#D49B35] bg-[#D49B35] text-[#0A1B42]"
                        : "border-white/15 bg-[#16357A]/60 text-white hover:bg-[#1D4396]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-blue-200/65">
                Podés ajustar el cupo individual de cada equipo abajo (por ejemplo, si un equipo lleva 8 jugadores y otro 7).
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {db.teams.map((team, idx) => {
                const cap = getTeamCapacity(
                  team,
                  db.teams.length,
                  activePlayersCount
                );
                return (
                <div
                  key={team.id}
                  className="rounded-2xl border border-white/12 bg-[#10295E]/70 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: team.color }}
                    />
                    <Input
                      value={team.name}
                      onChange={(e) =>
                        handleUpdateTeam(team.id, { name: e.target.value })
                      }
                      placeholder={`Equipo ${idx + 1}`}
                      className="h-10 text-sm font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0A1B42]/70 px-3 py-1.5">
                    <span className="text-xs font-semibold text-blue-200/80">
                      Jugadores en este equipo
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTeam(team.id, {
                            maxPlayers: Math.max(1, cap - 1),
                          })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-black tabular-nums text-[#F5CE78]">
                        {cap}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTeam(team.id, {
                            maxPlayers: Math.min(20, cap + 1),
                          })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D49B35] text-[#071433] hover:bg-[#E5B049] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TEAM_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        title={preset.name}
                        onClick={() =>
                          handleUpdateTeam(team.id, { color: preset.hex })
                        }
                        className={`h-6 w-6 rounded-full border-2 transition ${
                          team.color === preset.hex
                            ? "scale-110 border-[#D49B35] ring-2 ring-[#D49B35]/60"
                            : "border-white/30 opacity-75 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      />
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        );
      })()}

      {/* STEP: BOMBOS (Organizer only) */}
      {isOrganizer && step === "bombos" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-white">
                  Armado de Bombos (Bombo 1 a Bombo {db.draw.pots.length})
                </h3>
                <p className="text-xs text-blue-200/75">
                  Ordená por estrellas y goles 2025 o mové jugadores manualmente (arrastrá o usá el selector).
                </p>
              </div>
              <Button onClick={handleSuggestPots} className="shrink-0">
                <Sparkles className="h-4 w-4" />
                Sugerir bombos por estrellas y goles
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {db.draw.pots.map((pot, potIdx) => (
              <Card
                key={pot.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedPlayer) {
                    handleMovePlayerToPot(
                      draggedPlayer.playerId,
                      draggedPlayer.fromPotIndex,
                      potIdx
                    );
                    setDraggedPlayer(null);
                  }
                }}
                className="border-[#D49B35]/25"
              >
                <CardHeader className="pb-2.5">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-[#F0C46B]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D49B35]/25 text-xs font-extrabold">
                        {pot.number}
                      </span>
                      {pot.name}
                    </span>
                    <Badge variant="muted">{pot.playerIds.length} jug.</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {pot.playerIds.map((pid) => {
                    const p = playerMap.get(pid);
                    if (!p) return null;
                    return (
                      <div
                        key={pid}
                        draggable
                        onDragStart={() =>
                          setDraggedPlayer({
                            playerId: pid,
                            fromPotIndex: potIdx,
                          })
                        }
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#16357A]/55 px-2.5 py-2 text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-blue-200/40" />
                          <span className="truncate font-semibold text-white">
                            {p.name}
                          </span>
                          {p.stars > 0 && (
                            <span className="shrink-0 text-[#D49B35]">
                              {formatStars(p.stars)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.goals2025 > 0 && (
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-100">
                              {p.goals2025}G
                            </span>
                          )}
                          <select
                            aria-label={`Mover ${p.name} de bombo`}
                            value={potIdx}
                            onChange={(e) =>
                              handleMovePlayerToPot(
                                pid,
                                potIdx,
                                Number(e.target.value)
                              )
                            }
                            className="rounded-lg border border-white/15 bg-[#0A1B42] px-1.5 py-1 text-[11px] font-semibold text-[#F0C46B] focus:outline-none focus:ring-1 focus:ring-[#D49B35]"
                          >
                            {db.draw.pots.map((targetPot, idx) => (
                              <option key={targetPot.id} value={idx}>
                                B{targetPot.number}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* STEP: BOLILLERO INTERACTIVO + EQUIPOS */}
      {(!isOrganizer || step === "bolillero") && (
        <div className="space-y-4">
          {/* Interactive FIFA Bolillero Stage (Organizer) */}
          {isOrganizer ? (
            <Card className="overflow-hidden border-[#D49B35]/40 bg-gradient-to-b from-[#132E6B]/90 to-[#0A1B42]/95">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col items-center text-center">
                  {/* Status pill */}
                  <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                    <Badge variant="gold">
                      {remainingTotal === 0
                        ? "SORTEO COMPLETO"
                        : activePot
                          ? `${activePot.name.toUpperCase()} · ${activePotRemaining.length} bolillas`
                          : "LISTO PARA SORTEAR"}
                    </Badge>
                    <Badge variant="blue">
                      {totalDrawn} / {activePlayersCount} sorteados
                    </Badge>
                  </div>

                  {/* Golden Bolillero Visual */}
                  <div className="relative my-2 flex h-40 w-40 items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full border-4 border-dashed border-[#D49B35]/65 ${
                        isSpinning ? "animate-bolillero" : ""
                      }`}
                    />
                    <div
                      className={`relative flex h-32 w-32 flex-col items-center justify-center overflow-hidden rounded-full border-3 border-[#F0C46B] bg-[#183B74] shadow-xl shadow-[#D49B35]/30 ${
                        isSpinning ? "animate-bolillero" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/logo-copa-hosteria.jpg"
                        alt="Copa Hostería"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-2 rounded-full border border-[#F0C46B]/80 bg-[#0A1B42] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#F0C46B] shadow">
                      {isSpinning
                        ? "GIRANDO"
                        : activePot
                          ? `BOMBO ${activePot.number}`
                          : "COMPLETO"}
                    </span>
                  </div>

                  {/* Revealed Ball Banner */}
                  {lastDrawnPlayer && lastDrawnTeam && !isSpinning && (
                    <div
                      key={lastDrawnPlayer.id}
                      className="animate-ball-pop my-3 w-full max-w-md rounded-2xl border border-[#D49B35]/60 bg-[#0A1B42]/90 p-3.5 shadow-lg shadow-[#D49B35]/15"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#F0C46B]">
                        Bolilla revelada · Bombo {db.draw.lastDrawn?.potNumber}
                      </p>
                      <div className="mt-2 flex flex-col items-center">
                        <PlayerAvatar
                          name={lastDrawnPlayer.name}
                          photoUrl={lastDrawnPlayer.photoUrl}
                          stars={lastDrawnPlayer.stars}
                          size="lg"
                          className="mb-2"
                        />
                        <p className="text-xl font-black text-white">
                          {lastDrawnPlayer.name}{" "}
                          {lastDrawnPlayer.stars > 0 && (
                            <span className="text-[#D49B35]">
                              {formatStars(lastDrawnPlayer.stars)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-xs text-blue-200">
                        {lastDrawnPlayer.stars > 0 && (
                          <span className="rounded-md bg-[#D49B35]/20 px-2 py-0.5 font-bold text-[#F5CE78]">
                            {lastDrawnPlayer.stars === 1
                              ? "Campeón ★"
                              : `${lastDrawnPlayer.stars}× Campeón ${formatStars(lastDrawnPlayer.stars)}`}
                          </span>
                        )}
                        {((lastDrawnPlayer.goals2024 ?? 0) +
                          lastDrawnPlayer.goals2025) > 0 && (
                          <span>
                            {(lastDrawnPlayer.goals2024 ?? 0) +
                              lastDrawnPlayer.goals2025}{" "}
                            goles prev. ·
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 font-bold text-white">
                          <span
                            className="h-3 w-3 rounded-full border border-white"
                            style={{ backgroundColor: lastDrawnTeam.color }}
                          />
                          {lastDrawnTeam.name}
                        </span>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadPlayerCardPng(
                              lastDrawnPlayer,
                              lastDrawnTeam,
                              db.draw.lastDrawn?.potNumber
                            )
                          }
                          className="w-full"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Descargar tarjeta del jugador (PNG)
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Main Action Buttons */}
                  <div className="mt-3 grid w-full max-w-md grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Button
                      size="xl"
                      onClick={handleDrawSingleWithAnimation}
                      disabled={isSpinning || remainingTotal === 0}
                      className="w-full"
                    >
                      <Dices className="h-5 w-5" />
                      {isSpinning
                        ? "Sacando bolilla..."
                        : remainingTotal === 0
                          ? "Sorteo finalizado"
                          : "Sacar Bolilla"}
                    </Button>
                    <Button
                      size="xl"
                      variant="secondary"
                      onClick={handleQuickDraw}
                      disabled={isSpinning || remainingTotal === 0}
                      className="w-full"
                    >
                      <Shuffle className="h-5 w-5" />
                      Sortear Rápido
                    </Button>
                  </div>

                  {/* Secondary Organizer Actions */}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {totalDrawn > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isSpinning}
                        onClick={handleUndoLastBall}
                      >
                        <Undo2 className="h-3.5 w-3.5 text-[#F5CE78]" />
                        Deshacer última bolilla
                      </Button>
                    )}
                    {totalDrawn > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSwapOpen(true)}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        Intercambiar jugadores
                      </Button>
                    )}
                    {totalDrawn > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleResetDraw}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reiniciar sorteo
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-[#D49B35]/40 bg-gradient-to-r from-[#112A63]/95 via-[#0C2050]/95 to-[#091A42]/95">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                        Equipos · 4° Edición (28/11/2026)
                      </h2>
                      <Badge variant="gold">
                        {totalDrawn} / {activePlayersCount} sorteados
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-blue-100/80">
                      {totalDrawn === activePlayersCount && activePlayersCount > 0
                        ? "Sorteo oficial completo. ¡Equipos confirmados!"
                        : totalDrawn > 0
                          ? `${totalDrawn} de ${activePlayersCount} convocados ya fueron asignados en el sorteo.`
                          : "El sorteo oficial todavía no comenzó."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRequestOrganizer}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Organizador
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#D49B35] to-[#F5CE78] transition-all duration-500"
                    style={{
                      width: `${
                        activePlayersCount > 0
                          ? Math.min(100, Math.round((totalDrawn / activePlayersCount) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export / Share Bar */}
          {totalDrawn > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Button
                variant="success"
                size="lg"
                onClick={handleCopyWhatsApp}
                className="w-full"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    ¡Copiado para WhatsApp!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar para WhatsApp
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => downloadTeamsPosterPng(db.teams, db.players)}
                className="w-full"
              >
                <Download className="h-4 w-4" />
                Descargar placa PNG
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() =>
                  exportTeamsSheetPdf(db.teams, db.players, db.matches)
                }
                className="w-full"
              >
                <FileDown className="h-4 w-4 text-[#F0C46B]" />
                Exportar Planilla PDF
              </Button>
            </div>
          )}

          {/* Teams Grid */}
          <div
            className={`grid gap-3.5 ${
              db.teams.length === 4
                ? "sm:grid-cols-2"
                : db.teams.length === 8
                  ? "sm:grid-cols-2 lg:grid-cols-4"
                  : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {db.teams.map((team) => {
              const isJustDrawnTeam =
                db.draw.lastDrawn?.teamId === team.id && !isSpinning;
              return (
                <Card
                  key={team.id}
                  className={`overflow-hidden transition-all ${
                    isJustDrawnTeam
                      ? "border-[#F5CE78] ring-2 ring-[#D49B35]/45 shadow-lg shadow-[#D49B35]/15"
                      : "border-white/14 hover:border-white/24"
                  }`}
                >
                  {/* Team Color Accent Strip */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <CardHeader className="pb-2.5">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2.5 truncate">
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="truncate">{team.name}</span>
                      </span>
                      <Badge variant="muted">
                        {team.playerIds.length} /{" "}
                        {getTeamCapacity(
                          team,
                          db.teams.length,
                          activePlayersCount
                        )}{" "}
                        jug.
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {team.playerIds.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/14 bg-white/[0.03] py-6 text-center text-xs font-medium text-blue-100/70">
                        Esperando bolillas...
                      </div>
                    ) : (
                      team.playerIds.map((pid) => {
                        const p = playerMap.get(pid);
                        if (!p) return null;
                        const isLatest = db.draw.lastDrawn?.playerId === pid;
                        const isCaptain = team.captainId === pid;
                        return (
                          <div
                            key={pid}
                            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                              isLatest
                                ? "border border-[#F5CE78]/70 bg-[#D49B35]/18 shadow-sm shadow-[#D49B35]/15"
                                : isCaptain
                                  ? "border border-[#D49B35]/55 bg-[#D49B35]/12"
                                  : "border border-white/8 bg-[#143275]/55"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <PlayerAvatar
                                name={p.name}
                                photoUrl={p.photoUrl}
                                stars={p.stars}
                                size="xs"
                              />
                              <span className="truncate font-semibold text-white">
                                {p.name}
                              </span>
                              {isCaptain && (
                                <span
                                  title="Capitán del equipo"
                                  className="shrink-0 rounded-md bg-gradient-to-b from-[#F5CE78] to-[#D49B35] px-1.5 py-0.5 text-[10px] font-black text-[#071433] shadow-sm"
                                >
                                  CAP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {p.stars > 0 && (
                                <span
                                  className="text-xs font-bold text-[#F5CE78]"
                                  title={`${p.stars} campeonato(s)`}
                                >
                                  {formatStars(p.stars)}
                                </span>
                              )}
                              {((p.goals2024 ?? 0) + p.goals2025) > 0 && (
                                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-blue-100">
                                  {(p.goals2024 ?? 0) + p.goals2025}G
                                </span>
                              )}
                              {isOrganizer && (
                                <button
                                  type="button"
                                  title={
                                    isCaptain
                                      ? "Quitar cinta de capitán"
                                      : `Designar a ${p.name} como capitán`
                                  }
                                  onClick={() =>
                                    handleToggleCaptain(team.id, p.id)
                                  }
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-black transition active:scale-95 cursor-pointer ${
                                    isCaptain
                                      ? "border-[#F5CE78] bg-[#D49B35] text-[#071433]"
                                      : "border-white/15 bg-white/6 text-blue-200/75 hover:border-[#D49B35]/60 hover:text-[#F5CE78]"
                                  }`}
                                >
                                  C
                                </button>
                              )}
                              <button
                                type="button"
                                title={`Descargar tarjeta PNG de ${p.name}`}
                                onClick={() => {
                                  const pot = db.draw.pots.find((pt) =>
                                    pt.playerIds.includes(p.id)
                                  );
                                  downloadPlayerCardPng(
                                    p,
                                    team,
                                    pot?.number ?? null
                                  );
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D49B35]/35 bg-[#D49B35]/15 text-[#F5CE78] transition active:scale-95 hover:bg-[#D49B35]/30 cursor-pointer"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Swap Players Modal */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-[#D49B35]" />
              Intercambiar Jugadores
            </DialogTitle>
            <DialogDescription>
              Elegí un jugador de cada equipo para intercambiarlos post-sorteo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-blue-200">
                Jugador 1
              </label>
              <select
                value={swapA}
                onChange={(e) => setSwapA(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0A1B42] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D49B35]"
              >
                <option value="">Seleccionar jugador...</option>
                {db.teams.map((t) => (
                  <optgroup key={t.id} label={t.name}>
                    {t.playerIds.map((pid) => {
                      const p = playerMap.get(pid);
                      return p ? (
                        <option key={pid} value={pid}>
                          {p.name} {p.stars > 0 ? formatStars(p.stars) : ""} (
                          {t.name})
                        </option>
                      ) : null;
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-blue-200">
                Jugador 2
              </label>
              <select
                value={swapB}
                onChange={(e) => setSwapB(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0A1B42] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D49B35]"
              >
                <option value="">Seleccionar jugador...</option>
                {db.teams.map((t) => (
                  <optgroup key={t.id} label={t.name}>
                    {t.playerIds.map((pid) => {
                      const p = playerMap.get(pid);
                      return p ? (
                        <option key={pid} value={pid}>
                          {p.name} {p.stars > 0 ? formatStars(p.stars) : ""} (
                          {t.name})
                        </option>
                      ) : null;
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!swapA || !swapB || swapA === swapB}
              onClick={handleSwapPlayers}
            >
              Confirmar Intercambio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
