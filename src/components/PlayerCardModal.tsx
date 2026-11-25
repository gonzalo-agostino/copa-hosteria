"use client";

import React from "react";
import { Download } from "lucide-react";
import { Match, Player, Team } from "@/types/tournament";
import { downloadPlayerCardPng } from "@/lib/export";
import { formatStars } from "@/lib/utils";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamBadge } from "@/components/TeamBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlayerCardModalProps {
  player: Player | null;
  team?: Team | null;
  potNumber?: number | null;
  matches?: Match[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getChampionLabel(stars: number): string {
  if (stars === 1) return "★  CAMPEÓN COPA HOSTERÍA  ★";
  if (stars === 2) return "★★  BICAMPEÓN COPA HOSTERÍA  ★★";
  if (stars >= 3) {
    return `${"★".repeat(stars)}  MULTICAMPEÓN COPA HOSTERÍA  ${"★".repeat(stars)}`;
  }
  return "CONVOCADO · 4° EDICIÓN";
}

export function PlayerCardModal({
  player,
  team,
  potNumber,
  matches = [],
  open,
  onOpenChange,
}: PlayerCardModalProps) {
  if (!player) return null;

  const goals2024 = player.goals2024 ?? 0;
  const goals2025 = player.goals2025 ?? 0;
  const totalPastGoals = goals2024 + goals2025;

  let goals2026 = 0;
  let assists2026 = 0;
  for (const m of matches) {
    for (const ev of m.events) {
      if (ev.type === "gol") {
        if (ev.playerId === player.id) goals2026 += 1;
        if (ev.assistPlayerId === player.id) assists2026 += 1;
      }
    }
  }

  const isCaptain = Boolean(team && team.captainId === player.id);
  const isTeamDT = Boolean(team && team.dtId === player.id);

  const pastBreakdown: string[] = [];
  if (goals2024 > 0) pastBreakdown.push(`2024: ${goals2024}G`);
  if (goals2025 > 0) pastBreakdown.push(`2025: ${goals2025}G`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] overflow-hidden border-2 border-[#D49B35] bg-gradient-to-b from-[#071433] via-[#0F2557] to-[#16357A] p-0 shadow-[0_28px_70px_rgba(0,0,0,0.8)]">
        <DialogTitle className="sr-only">
          Tarjeta de {player.name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Ficha oficial de {player.name} en Copa Hostería 4° Edición
        </DialogDescription>

        {/* Inner decorative gold frame */}
        <div className="relative m-2.5 rounded-[22px] border border-[#F0C46B]/35 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {/* Golden radial aura behind avatar */}
          <div
            className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(212,155,53,0.65) 0%, rgba(212,155,53,0) 72%)",
            }}
          />

          {/* Top Header */}
          <div className="relative flex items-center justify-between gap-2 border-b border-[#D49B35]/40 pb-3 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-copa-hosteria.jpg"
                alt="Copa Hostería"
                className="h-10 w-10 shrink-0 rounded-xl border border-[#D49B35] object-cover shadow"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-tight text-white">
                  COPA HOSTERÍA
                </p>
                <p className="text-[11px] font-bold text-[#F0C46B]">
                  4° EDICIÓN · 28.11.2026
                </p>
              </div>
            </div>
            {potNumber && (
              <span className="shrink-0 rounded-full border border-[#F0C46B]/65 bg-[#D49B35]/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#F0C46B]">
                Bombo {potNumber}
              </span>
            )}
          </div>

          {/* Champion / Status Pill */}
          <div className="relative mt-3.5 flex justify-center">
            <span
              className={`inline-flex items-center rounded-full border px-3.5 py-1 text-[11px] font-extrabold tracking-wide ${
                player.stars > 0
                  ? "border-[#F0C46B] bg-[#D49B35]/22 text-[#F5CE78]"
                  : "border-white/25 bg-white/8 text-blue-100"
              }`}
            >
              {getChampionLabel(player.stars)}
            </span>
          </div>

          {/* Player Circular Photo / Avatar */}
          <div className="relative mt-4 flex justify-center">
            <div
              className={`rounded-full p-1.5 ${
                player.stars > 0
                  ? "ring-2 ring-[#F0C46B] shadow-lg shadow-[#D49B35]/25"
                  : "ring-2 ring-[#D49B35]/60"
              }`}
            >
              <PlayerAvatar
                name={player.name}
                photoUrl={player.photoUrl}
                stars={player.stars}
                size="lg"
                className="h-28 w-28 sm:h-32 sm:w-32 text-3xl"
              />
            </div>
          </div>

          {/* Player Name & Position / Stars */}
          <div className="relative mt-3.5 text-center">
            <h2 className="text-2xl sm:text-[26px] font-black uppercase tracking-tight text-white leading-tight">
              {player.name}
            </h2>
            {(player.position || player.stars > 0 || player.isSubstitute || player.isDT) && (
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold text-[#F5CE78]">
                {player.position && (
                  <span className="uppercase tracking-wider">
                    {player.position}
                  </span>
                )}
                {player.stars > 0 && (
                  <span className="text-sm">{formatStars(player.stars)}</span>
                )}
                {player.isDT && (
                  <span className="rounded-md bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-[#071433]">
                    DT
                  </span>
                )}
                {player.isSubstitute && (
                  <span className="rounded-md border border-amber-400/60 bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                    SUP
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Assigned Team Banner */}
          {team && (
            <div
              className="relative mt-4 flex items-center gap-3 rounded-2xl border-2 bg-[#071433]/85 px-3.5 py-2.5"
              style={{
                borderColor: team.color === "#F8FAFC" ? "#F0C46B" : team.color,
              }}
            >
              <TeamBadge
                name={team.name}
                color={team.color}
                imageUrl={team.imageUrl}
                size="lg"
              />
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isCaptain
                      ? "text-[#F5CE78]"
                      : isTeamDT
                        ? "text-emerald-300"
                        : "text-blue-200/75"
                  }`}
                >
                  {isCaptain && isTeamDT
                    ? "© Capitán y DT del equipo"
                    : isTeamDT
                      ? "DT · Director Técnico"
                      : isCaptain
                        ? "© Capitán del equipo"
                        : "Equipo asignado"}
                </p>
                <p className="truncate text-lg font-black uppercase tracking-tight text-white">
                  {team.name}
                </p>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="relative mt-3.5 grid grid-cols-2 gap-2.5">
            {/* Titles */}
            <div className="rounded-2xl border border-[#D49B35]/45 bg-[#071433]/82 p-3 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#F0C46B]">
                Historial de Títulos
              </p>
              <p
                className={`mt-1.5 text-2xl font-black ${
                  player.stars > 0 ? "text-[#F5CE78]" : "text-slate-400"
                }`}
              >
                {player.stars > 0 ? formatStars(player.stars) : "—"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-blue-100/85">
                {player.stars === 1
                  ? "1 vez Campeón"
                  : player.stars > 1
                    ? `${player.stars} veces Campeón`
                    : "Busca su 1ª estrella"}
              </p>
            </div>

            {/* Historical Goals */}
            <div className="rounded-2xl border border-[#D49B35]/45 bg-[#071433]/82 p-3 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#F0C46B]">
                Goles Anteriores
              </p>
              <p
                className={`mt-1.5 text-2xl font-black tabular-nums ${
                  totalPastGoals > 0 ? "text-white" : "text-slate-400"
                }`}
              >
                {totalPastGoals}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-blue-100/85">
                {pastBreakdown.length > 0
                  ? pastBreakdown.join(" · ")
                  : "Sin goles previos"}
              </p>
            </div>
          </div>

          {/* 2026 Live Stats Pill (if player has goals or assists in 2026) */}
          {(goals2026 > 0 || assists2026 > 0) && (
            <div className="relative mt-2.5 flex items-center justify-center gap-4 rounded-xl border border-emerald-400/35 bg-emerald-500/12 px-3 py-2 text-xs font-bold text-emerald-100">
              <span>4° Edición (2026):</span>
              {goals2026 > 0 && (
                <span>
                  ⚽ {goals2026} {goals2026 === 1 ? "gol" : "goles"}
                </span>
              )}
              {assists2026 > 0 && (
                <span>
                  🎯 {assists2026} {assists2026 === 1 ? "asist." : "asist."}
                </span>
              )}
            </div>
          )}

          {/* Optional Download Button */}
          <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200/60">
              Copa Hostería · 2026
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadPlayerCardPng(player, team ?? null, potNumber ?? null)
              }
              className="h-8 border-[#D49B35]/50 text-xs text-[#F5CE78] hover:bg-[#D49B35]/20"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
