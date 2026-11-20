"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Camera,
  Search,
  Star,
  Trash2,
  Users,
  Lock,
  Loader2,
  Pencil,
  UserPlus,
  Download,
} from "lucide-react";
import { Player, PlayerPosition, Team, TournamentDB } from "@/types/tournament";
import { formatStars } from "@/lib/utils";
import { downloadPlayerCardPng } from "@/lib/export";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POSITION_OPTIONS: { value: PlayerPosition; label: string }[] = [
  { value: "", label: "Sin posición definida" },
  { value: "Arquero", label: "Arquero" },
  { value: "Defensor", label: "Defensor" },
  { value: "Mediocampista", label: "Mediocampista" },
  { value: "Delantero", label: "Delantero" },
];

interface PlayersRosterModuleProps {
  db: TournamentDB;
  isOrganizer: boolean;
  onUpdateDB: (updater: (prev: TournamentDB) => TournamentDB) => void;
  onReplaceDB: (nextDB: TournamentDB) => void;
  onRequestOrganizer: () => void;
}

interface PlayerFormState {
  id: string | null; // null = creating new player
  name: string;
  position: PlayerPosition;
  stars: number;
  goals2024: number;
  goals2025: number;
  convocadoActual: boolean;
}

async function compressImageToJpeg(file: File, maxSize = 420): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

export function PlayersRosterModule({
  db,
  isOrganizer,
  onUpdateDB,
  onReplaceDB,
  onRequestOrganizer,
}: PlayersRosterModuleProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "convocados" | "campeones" | "historicos"
  >("convocados");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PlayerFormState>({
    id: null,
    name: "",
    position: "",
    stars: 0,
    goals2024: 0,
    goals2025: 0,
    convocadoActual: true,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const targetPlayerIdRef = useRef<string | null>(null);

  const teamByPlayer = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of db.teams) {
      for (const pid of t.playerIds) {
        map.set(pid, t);
      }
    }
    return map;
  }, [db.teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.players
      .filter((p) => {
        if (filter === "convocados" && !p.convocadoActual) return false;
        if (filter === "campeones" && p.stars === 0) return false;
        if (filter === "historicos" && p.convocadoActual) return false;
        if (q) {
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesPos = (p.position ?? "").toLowerCase().includes(q);
          if (!matchesName && !matchesPos) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (filter === "campeones" && b.stars !== a.stars)
          return b.stars - a.stars;
        if (filter === "historicos") {
          const histA = (a.goals2024 ?? 0) + a.goals2025;
          const histB = (b.goals2024 ?? 0) + b.goals2025;
          if (histB !== histA) return histB - histA;
        }
        return a.name.localeCompare(b.name, "es");
      });
  }, [db.players, filter, query]);

  const convocadosCount = db.players.filter((p) => p.convocadoActual).length;
  const campeonesCount = db.players.filter((p) => p.stars > 0).length;
  const historicosCount = db.players.filter((p) => !p.convocadoActual).length;
  const photosLoadedCount = db.players.filter((p) => Boolean(p.photoUrl)).length;

  const openCreateModal = () => {
    setForm({
      id: null,
      name: "",
      position: "",
      stars: 0,
      goals2024: 0,
      goals2025: 0,
      convocadoActual: true,
    });
    setFormOpen(true);
  };

  const openEditModal = (p: Player) => {
    setForm({
      id: p.id,
      name: p.name,
      position: p.position ?? "",
      stars: p.stars,
      goals2024: p.goals2024 ?? 0,
      goals2025: p.goals2025,
      convocadoActual: p.convocadoActual,
    });
    setFormOpen(true);
  };

  const handleSavePlayer = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) return;

    onUpdateDB((prev) => {
      if (form.id) {
        const prevPlayer = prev.players.find((p) => p.id === form.id);
        const nextPlayers = prev.players.map((p) =>
          p.id === form.id
            ? {
                ...p,
                name: trimmedName,
                position: form.position,
                stars: Math.max(0, Math.min(10, Number(form.stars) || 0)),
                goals2024: Math.max(0, Number(form.goals2024) || 0),
                goals2025: Math.max(0, Number(form.goals2025) || 0),
                convocadoActual: form.convocadoActual,
              }
            : p
        );

        // Keep draw pots in sync if convocadoActual toggled
        let nextPots = prev.draw.pots;
        let nextTeams = prev.teams;
        let nextDrawnIds = prev.draw.drawnPlayerIds;

        if (prevPlayer && prevPlayer.convocadoActual !== form.convocadoActual) {
          if (form.convocadoActual) {
            const alreadyInPot = nextPots.some((pot) =>
              pot.playerIds.includes(form.id!)
            );
            if (!alreadyInPot && nextPots.length > 0) {
              nextPots = nextPots.map((pot, idx) =>
                idx === nextPots.length - 1
                  ? { ...pot, playerIds: [...pot.playerIds, form.id!] }
                  : pot
              );
            }
          } else {
            nextPots = nextPots.map((pot) => ({
              ...pot,
              playerIds: pot.playerIds.filter((pid) => pid !== form.id),
            }));
            nextTeams = nextTeams.map((t) => ({
              ...t,
              playerIds: t.playerIds.filter((pid) => pid !== form.id),
            }));
            nextDrawnIds = nextDrawnIds.filter((pid) => pid !== form.id);
          }
        }

        return {
          ...prev,
          players: nextPlayers,
          teams: nextTeams,
          draw: {
            ...prev.draw,
            pots: nextPots,
            drawnPlayerIds: nextDrawnIds,
          },
        };
      } else {
        // Create new player
        const newId = `p-${crypto.randomUUID().slice(0, 8)}`;
        const newPlayer: Player = {
          id: newId,
          name: trimmedName,
          position: form.position,
          stars: Math.max(0, Math.min(10, Number(form.stars) || 0)),
          goals2024: Math.max(0, Number(form.goals2024) || 0),
          goals2025: Math.max(0, Number(form.goals2025) || 0),
          assists2025: 0,
          yellowCards2025: 0,
          redCards2025: 0,
          convocadoActual: form.convocadoActual,
          photoUrl: null,
        };

        let nextPots = prev.draw.pots;
        if (form.convocadoActual && nextPots.length > 0) {
          nextPots = nextPots.map((pot, idx) =>
            idx === nextPots.length - 1
              ? { ...pot, playerIds: [...pot.playerIds, newId] }
              : pot
          );
        }

        return {
          ...prev,
          players: [...prev.players, newPlayer],
          draw: {
            ...prev.draw,
            pots: nextPots,
          },
        };
      }
    });

    setFormOpen(false);
  };

  const handleDeletePlayer = (playerId: string) => {
    onUpdateDB((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
      teams: prev.teams.map((t) => ({
        ...t,
        playerIds: t.playerIds.filter((pid) => pid !== playerId),
      })),
      draw: {
        ...prev.draw,
        pots: prev.draw.pots.map((pot) => ({
          ...pot,
          playerIds: pot.playerIds.filter((pid) => pid !== playerId),
        })),
        drawnPlayerIds: prev.draw.drawnPlayerIds.filter(
          (pid) => pid !== playerId
        ),
      },
    }));
    setFormOpen(false);
  };

  const triggerPhotoPicker = (playerId: string) => {
    targetPlayerIdRef.current = playerId;
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const playerId = targetPlayerIdRef.current;
    if (!file || !playerId) return;

    setUploadingId(playerId);
    setUploadError(null);
    try {
      const compressed = await compressImageToJpeg(file);
      const formData = new FormData();
      formData.append("file", compressed, `${playerId}.jpg`);

      const res = await fetch(`/api/players/${playerId}/photo`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error ?? "No se pudo subir la foto");
      }

      const data = (await res.json()) as { db: TournamentDB };
      if (data.db) {
        onReplaceDB(data.db);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Error al subir la foto"
      );
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeletePhoto = async (playerId: string) => {
    setUploadingId(playerId);
    setUploadError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/photo`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = (await res.json()) as { db: TournamentDB };
        if (data.db) onReplaceDB(data.db);
      }
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden shared file input for mobile gallery / camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Roster / Organizer Action Banner */}
      <Card className="border-[#D49B35]/35">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">
              Padrón de Jugadores · {photosLoadedCount} / {db.players.length}{" "}
              con foto
            </p>
            <p className="text-xs text-blue-100/75">
              {isOrganizer
                ? "Podés editar nombre, posición, estrellas, goles, foto o agregar jugadores nuevos."
                : "Desbloqueá el Modo Organizador para editar jugadores o cargar fotos."}
            </p>
          </div>
          {isOrganizer ? (
            <Button size="sm" onClick={openCreateModal} className="shrink-0">
              <UserPlus className="h-4 w-4" />
              + Nuevo Jugador
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onRequestOrganizer}
              className="shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              Editar padrón
            </Button>
          )}
        </CardContent>
      </Card>

      {uploadError && (
        <div className="rounded-xl border border-red-400/50 bg-red-950/60 px-3.5 py-2.5 text-xs font-semibold text-red-200">
          {uploadError}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/55" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o posición..."
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/14 bg-[#071433]/85 p-1.5 shadow-inner shadow-black/20">
        <button
          type="button"
          onClick={() => setFilter("convocados")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
            filter === "convocados"
              ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-sm shadow-[#D49B35]/25"
              : "text-blue-100/80 hover:bg-white/8 hover:text-white"
          }`}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">2026 ({convocadosCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("campeones")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
            filter === "campeones"
              ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-sm shadow-[#D49B35]/25"
              : "text-blue-100/80 hover:bg-white/8 hover:text-white"
          }`}
        >
          <Star className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Campeones ({campeonesCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("historicos")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
            filter === "historicos"
              ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-sm shadow-[#D49B35]/25"
              : "text-blue-100/80 hover:bg-white/8 hover:text-white"
          }`}
        >
          <span className="truncate">Históricos ({historicosCount})</span>
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {filtered.map((p) => {
          const team = teamByPlayer.get(p.id);
          const isBusy = uploadingId === p.id;
          return (
            <Card
              key={p.id}
              className="transition hover:border-[#D49B35]/40 hover:bg-[#0C2152]/85"
            >
              <CardContent className="flex items-center justify-between gap-2.5 p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    disabled={!isOrganizer || isBusy}
                    onClick={() => isOrganizer && triggerPhotoPicker(p.id)}
                    title={
                      isOrganizer
                        ? "Tocá para cargar o cambiar foto"
                        : p.name
                    }
                    className={`relative shrink-0 rounded-full ${
                      isOrganizer ? "cursor-pointer group" : "cursor-default"
                    }`}
                  >
                    <PlayerAvatar
                      name={p.name}
                      photoUrl={p.photoUrl}
                      stars={p.stars}
                      size="md"
                    />
                    {isBusy && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                        <Loader2 className="h-4 w-4 animate-spin text-[#F5CE78]" />
                      </div>
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white leading-snug">
                      {p.name}{" "}
                      {p.stars > 0 && (
                        <span className="text-[#F5CE78]">
                          {formatStars(p.stars)}
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-blue-100/80">
                      {p.position && (
                        <Badge
                          variant="blue"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {p.position}
                        </Badge>
                      )}
                      {team ? (
                        <span className="inline-flex items-center gap-1 font-medium text-white/90">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-white/80"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </span>
                      ) : p.convocadoActual ? (
                        <span>Convocado 2026</span>
                      ) : (
                        <span className="text-[#F5CE78]/90">
                          {(p.goals2024 ?? 0) > 0 && p.goals2025 === 0
                            ? "Histórico 2024"
                            : "Histórico 2025"}
                        </span>
                      )}
                      {(p.goals2024 ?? 0) > 0 && (
                        <Badge
                          variant="gold"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {p.goals2024}G · 2024
                        </Badge>
                      )}
                      {p.goals2025 > 0 && (
                        <Badge
                          variant="gold"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {p.goals2025}G · 2025
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const pot = db.draw.pots.find((pt) =>
                        pt.playerIds.includes(p.id)
                      );
                      downloadPlayerCardPng(p, team ?? null, pot?.number ?? null);
                    }}
                    title="Descargar tarjeta PNG del jugador"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-blue-100 transition active:scale-95 hover:border-[#D49B35]/60 hover:bg-[#D49B35]/20 hover:text-[#F5CE78] cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {isOrganizer && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditModal(p)}
                        title="Editar datos del jugador"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-white transition active:scale-95 hover:border-[#D49B35]/60 hover:bg-[#D49B35]/20 hover:text-[#F5CE78]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => triggerPhotoPicker(p.id)}
                        title={p.photoUrl ? "Cambiar foto" : "Subir foto"}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D49B35]/40 bg-[#D49B35]/15 text-[#F5CE78] transition active:scale-95 hover:bg-[#D49B35]/25 disabled:opacity-45"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                      {p.photoUrl && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeletePhoto(p.id)}
                          title="Eliminar foto"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-blue-200/60 transition active:scale-95 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-45"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create / Edit Player Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.id ? (
                <Pencil className="h-5 w-5 text-[#D49B35]" />
              ) : (
                <UserPlus className="h-5 w-5 text-[#D49B35]" />
              )}
              {form.id ? "Editar Jugador" : "Nuevo Jugador"}
            </DialogTitle>
            <DialogDescription>
              Modificá nombre, posición, estrellas de campeón, goles históricos o convocatoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-blue-100">
                Nombre y apellido
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Nico Castiñeira"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-blue-100">
                Posición
              </label>
              <select
                value={form.position}
                onChange={(e) =>
                  setForm({
                    ...form,
                    position: e.target.value as PlayerPosition,
                  })
                }
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0A1B42] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D49B35]"
              >
                {POSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-blue-100">
                  Estrellas ★
                </label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={form.stars}
                  onChange={(e) =>
                    setForm({ ...form, stars: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-blue-100">
                  Goles 2024
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.goals2024}
                  onChange={(e) =>
                    setForm({ ...form, goals2024: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-blue-100">
                  Goles 2025
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.goals2025}
                  onChange={(e) =>
                    setForm({ ...form, goals2025: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/12 bg-[#0A1B42]/70 px-3.5 py-3">
              <div>
                <p className="text-sm font-bold text-white">
                  Convocado 4° Edición (2026)
                </p>
                <p className="text-[11px] text-blue-200/70">
                  Si se desactiva, queda solo en el padrón histórico.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.convocadoActual}
                onChange={(e) =>
                  setForm({ ...form, convocadoActual: e.target.checked })
                }
                className="h-5 w-5 accent-[#D49B35] cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                size="lg"
                className="w-full"
                disabled={!form.name.trim()}
                onClick={handleSavePlayer}
              >
                {form.id ? "Guardar Cambios" : "Agregar Jugador"}
              </Button>

              {form.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-red-300 hover:bg-red-500/15 hover:text-red-200"
                  onClick={() => handleDeletePlayer(form.id!)}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar jugador del padrón
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
