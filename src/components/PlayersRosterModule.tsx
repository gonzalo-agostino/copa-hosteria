"use client";

import React, { useMemo, useRef, useState } from "react";
import { Camera, Search, Star, Trash2, Users, Lock, Loader2 } from "lucide-react";
import { TournamentDB } from "@/types/tournament";
import { formatStars } from "@/lib/utils";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PlayersRosterModuleProps {
  db: TournamentDB;
  isOrganizer: boolean;
  onReplaceDB: (nextDB: TournamentDB) => void;
  onRequestOrganizer: () => void;
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
  onReplaceDB,
  onRequestOrganizer,
}: PlayersRosterModuleProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"convocados" | "campeones" | "historicos">(
    "convocados"
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const targetPlayerIdRef = useRef<string | null>(null);

  const teamByPlayer = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const t of db.teams) {
      for (const pid of t.playerIds) {
        map.set(pid, { name: t.name, color: t.color });
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
        if (q && !p.name.toLowerCase().includes(q)) return false;
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

      {/* Photos banner */}
      <Card className="border-[#D49B35]/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm sm:text-base font-extrabold text-white">
              Fotos del Padrón · {photosLoadedCount} / {db.players.length}
            </p>
            <p className="mt-0.5 text-xs sm:text-sm text-blue-100/80">
              {isOrganizer
                ? "Tocá el ícono de cámara en cualquier jugador para cargar o cambiar su foto."
                : "Desbloqueá el Modo Organizador para cargar o editar fotos de los jugadores."}
            </p>
          </div>
          {!isOrganizer && (
            <Button size="sm" variant="outline" onClick={onRequestOrganizer}>
              <Lock className="h-3.5 w-3.5" />
              Cargar fotos
            </Button>
          )}
        </CardContent>
      </Card>

      {uploadError && (
        <div className="rounded-xl border border-red-400/50 bg-red-950/60 px-3.5 py-2.5 text-xs font-semibold text-red-100">
          {uploadError}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/70" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jugador por nombre..."
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
              <CardContent className="flex items-center justify-between gap-2.5 p-3.5 sm:p-4">
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-blue-100/80">
                      {team ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-white/90">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-white/80"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </span>
                      ) : p.convocadoActual ? (
                        <span>Convocado 4° Edición</span>
                      ) : (
                        <span className="text-[#F5CE78]/90">
                          {(p.goals2024 ?? 0) > 0 && p.goals2025 === 0
                            ? "Padrón Histórico 2024"
                            : "Padrón Histórico 2025"}
                        </span>
                      )}
                      {(p.goals2024 ?? 0) > 0 && (
                        <Badge variant="gold" className="px-1.5 py-0 text-[10px]">
                          {p.goals2024}G · 2024
                        </Badge>
                      )}
                      {p.goals2025 > 0 && (
                        <Badge variant="gold" className="px-1.5 py-0 text-[10px]">
                          {p.goals2025}G · 2025
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {isOrganizer && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => triggerPhotoPicker(p.id)}
                      title={p.photoUrl ? "Cambiar foto" : "Subir foto"}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D49B35]/40 bg-[#D49B35]/15 text-[#F0C46B] transition active:scale-95 hover:bg-[#D49B35]/25 disabled:opacity-45"
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
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
