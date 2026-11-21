"use client";

import React, { useMemo, useState } from "react";
import { Trophy, Target, HandHelping } from "lucide-react";
import { TournamentDB } from "@/types/tournament";
import { SEED_EDITIONS } from "@/lib/seed";
import {
  calculatePlayerStats,
  calculateStandings,
  StatsScope,
} from "@/lib/stats";
import { formatStars } from "@/lib/utils";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatsModuleProps {
  db: TournamentDB;
}

type StatsTab = "posiciones" | "goleadores" | "asistidores";

export function StatsModule({ db }: StatsModuleProps) {
  const [scope, setScope] = useState<StatsScope>("all");
  const [activeTab, setActiveTab] = useState<StatsTab>("posiciones");

  const standings = useMemo(
    () => calculateStandings(db.teams, db.matches),
    [db.teams, db.matches]
  );

  const playerStats = useMemo(
    () => calculatePlayerStats(db.players, db.teams, db.matches, scope),
    [db.players, db.teams, db.matches, scope]
  );

  const topScorers = useMemo(
    () =>
      [...playerStats]
        .filter((r) => r.goals > 0)
        .sort((a, b) => {
          if (b.goals !== a.goals) return b.goals - a.goals;
          if (b.player.stars !== a.player.stars)
            return b.player.stars - a.player.stars;
          return a.player.name.localeCompare(b.player.name, "es");
        }),
    [playerStats]
  );

  const topAssisters = useMemo(
    () =>
      [...playerStats]
        .filter((r) => r.assists > 0)
        .sort((a, b) => {
          if (b.assists !== a.assists) return b.assists - a.assists;
          return a.player.name.localeCompare(b.player.name, "es");
        }),
    [playerStats]
  );

  const playerMap = useMemo(
    () => new Map(db.players.map((p) => [p.id, p])),
    [db.players]
  );

  const officialEditions = useMemo(() => {
    const hasSyncedEditions =
      Array.isArray(db.editions) &&
      db.editions.length === SEED_EDITIONS.length &&
      db.editions.every((ed, idx) => {
        const seedEd = SEED_EDITIONS[idx];
        const sameIds =
          JSON.stringify(ed.championPlayerIds ?? []) ===
          JSON.stringify(seedEd.championPlayerIds ?? []);
        return (
          ed.date === seedEd.date &&
          ed.champion === seedEd.champion &&
          sameIds
        );
      });
    return hasSyncedEditions ? db.editions : SEED_EDITIONS;
  }, [db.editions]);

  return (
    <div className="space-y-4">
      {/* Palmarés / Historial de Ediciones */}
      {officialEditions.length > 0 && (
        <Card className="border-[#D49B35]/35 bg-gradient-to-r from-[#102860]/95 via-[#0B1E4C]/95 to-[#091A42]/95">
          <CardHeader className="pb-2.5">
            <CardTitle className="flex items-center justify-between text-sm sm:text-base">
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#F5CE78]" />
                Palmarés · Ediciones Copa Hostería
              </span>
              <Badge variant="gold">{officialEditions.length} ediciones</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {officialEditions.map((ed) => (
              <div
                key={ed.id}
                className={`rounded-xl border px-3.5 py-3 transition ${
                  ed.isActive
                    ? "border-[#F5CE78]/65 bg-[#D49B35]/15 shadow-sm shadow-[#D49B35]/15"
                    : "border-white/12 bg-[#143275]/45"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F5CE78]">
                    {ed.shortName}
                  </span>
                  <span className="text-xs" aria-hidden="true">
                    {ed.isActive ? "🔜" : "🏆"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold tabular-nums text-blue-100/80">
                  {ed.date}
                </p>
                <p
                  className={`mt-1.5 truncate text-xs sm:text-[13px] font-black tracking-tight ${
                    ed.isActive ? "text-[#F5CE78]" : "text-white"
                  }`}
                  title={
                    ed.isActive
                      ? "Próxima edición"
                      : (ed.champion ?? "Edición anterior")
                  }
                >
                  {ed.isActive
                    ? "Próxima edición"
                    : (ed.champion ?? "Edición anterior")}
                </p>
                {!ed.isActive &&
                  ed.championPlayerIds &&
                  ed.championPlayerIds.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1 border-t border-white/10 pt-2">
                      {ed.championPlayerIds.map((pid) => {
                        const p = playerMap.get(pid);
                        if (!p) return null;
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1 rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-blue-100/90"
                          >
                            <span>{p.name}</span>
                            {p.position === "Arquero" && (
                              <span className="text-[9px] font-bold text-[#F5CE78]">
                                (ARQ)
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stat Category Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/14 bg-[#071433]/85 p-1.5 shadow-inner shadow-black/20">
        {(
          [
            { id: "posiciones", label: "Posiciones", icon: Trophy },
            { id: "goleadores", label: "Goles", icon: Target },
            { id: "asistidores", label: "Asist.", icon: HandHelping },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl py-2.5 px-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer ${
              activeTab === id
                ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-sm shadow-[#D49B35]/25"
                : "text-blue-100/80 hover:bg-white/8 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Scope Filter (applies to individual player stats: Goles, Asistencias) */}
      {activeTab !== "posiciones" && (
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#D49B35]/30 bg-[#091A42]/80 p-1.5">
          <button
            type="button"
            onClick={() => setScope("2026")}
            className={`rounded-xl py-2 px-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
              scope === "2026"
                ? "bg-[#173982] text-[#F5CE78] border border-[#D49B35]/50 shadow-sm"
                : "text-blue-100/80 hover:text-white"
            }`}
          >
            4° Edición (2026)
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`rounded-xl py-2 px-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
              scope === "all"
                ? "bg-[#173982] text-[#F5CE78] border border-[#D49B35]/50 shadow-sm"
                : "text-blue-100/80 hover:text-white"
            }`}
          >
            Histórico Total (2024–2026)
          </button>
        </div>
      )}

      {/* 1. TABLA DE POSICIONES */}
      {activeTab === "posiciones" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#F5CE78]" />
                Tabla de Posiciones · 4° Edición
              </span>
              <Badge variant="gold">2026</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/14 text-[11px] font-bold uppercase tracking-wider text-blue-100/80">
                    <th className="py-3 pl-2.5 pr-1">#</th>
                    <th className="py-3 px-1.5">Equipo</th>
                    <th className="py-3 px-1.5 text-center">PJ</th>
                    <th className="py-3 px-1.5 text-center">G</th>
                    <th className="py-3 px-1.5 text-center">E</th>
                    <th className="py-3 px-1.5 text-center">P</th>
                    <th className="py-3 px-1.5 text-center hidden sm:table-cell">
                      GF
                    </th>
                    <th className="py-3 px-1.5 text-center hidden sm:table-cell">
                      GC
                    </th>
                    <th className="py-3 px-1.5 text-center">DG</th>
                    <th className="py-3 pl-1.5 pr-2.5 text-center text-[#F5CE78]">
                      Pts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {standings.map((row, idx) => (
                    <tr
                      key={row.teamId}
                      className={`transition hover:bg-white/5 ${
                        idx === 0 ? "bg-[#D49B35]/12" : ""
                      }`}
                    >
                      <td className="py-3.5 pl-2.5 pr-1 font-extrabold">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            idx === 0
                              ? "bg-[#D49B35] text-[#071433]"
                              : idx === 1
                                ? "bg-slate-300/25 text-slate-100"
                                : idx === 2
                                  ? "bg-amber-700/40 text-amber-200"
                                  : "text-blue-100/80"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-1.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white/90 shadow-sm"
                            style={{ backgroundColor: row.teamColor }}
                          />
                          <span className="truncate font-bold text-white max-w-[115px] sm:max-w-none">
                            {row.teamName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-1.5 text-center tabular-nums text-blue-50">
                        {row.pj}
                      </td>
                      <td className="py-3.5 px-1.5 text-center tabular-nums text-blue-50">
                        {row.g}
                      </td>
                      <td className="py-3.5 px-1.5 text-center tabular-nums text-blue-50">
                        {row.e}
                      </td>
                      <td className="py-3.5 px-1.5 text-center tabular-nums text-blue-50">
                        {row.p}
                      </td>
                      <td className="py-3.5 px-1.5 text-center tabular-nums text-blue-100/90 hidden sm:table-cell">
                        {row.gf}
                      </td>
                      <td className="py-3.5 px-1.5 text-center tabular-nums text-blue-100/90 hidden sm:table-cell">
                        {row.gc}
                      </td>
                      <td className="py-3.5 px-1.5 text-center tabular-nums font-semibold text-blue-100">
                        {row.dg > 0 ? `+${row.dg}` : row.dg}
                      </td>
                      <td className="py-3.5 pl-1.5 pr-2.5 text-center font-black tabular-nums text-[#F5CE78]">
                        {row.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. TABLA DE GOLEADORES */}
      {activeTab === "goleadores" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#D49B35]" />
                Tabla de Goleadores
              </span>
              <Badge variant="gold">
                {scope === "all" ? "Histórico 2024–2026" : "Solo 2026"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topScorers.length === 0 ? (
              <p className="py-8 text-center text-sm text-blue-100/75">
                Todavía no hay goles registrados en la 4° Edición (2026). Probá cambiar el filtro a &quot;Histórico Total (2025 + 2026)&quot;.
              </p>
            ) : (
              topScorers.map((row, idx) => (
                <div
                  key={row.player.id}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                    idx === 0
                      ? "border border-[#D49B35]/55 bg-[#D49B35]/15"
                      : "bg-[#16357A]/45"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        idx === 0
                          ? "bg-[#D49B35] text-[#0A1B42]"
                          : "bg-white/10 text-blue-100"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <PlayerAvatar
                      name={row.player.name}
                      photoUrl={row.player.photoUrl}
                      stars={row.player.stars}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {row.player.name}{" "}
                        {row.player.stars > 0 && (
                          <span className="text-[#D49B35]">
                            {formatStars(row.player.stars)}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-blue-100/80">
                        {row.teamName ? (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: row.teamColor }}
                            />
                            {row.teamName}
                          </span>
                        ) : !row.player.convocadoActual ? (
                          <span className="text-[#F5CE78]/90">
                            {(row.player.goals2024 ?? 0) > 0 && row.player.goals2025 === 0
                              ? "Histórico 2024"
                              : "Histórico"}
                          </span>
                        ) : (
                          <span>Convocado 2026</span>
                        )}
                        {scope === "all" && (
                          <span className="text-[10px] font-semibold text-blue-200/75">
                            {[
                              (row.player.goalsEd1 ?? 0) > 0
                                ? `Ed.1: ${row.player.goalsEd1}`
                                : null,
                              (row.player.goalsEd2 ?? 0) > 0
                                ? `Ed.2: ${row.player.goalsEd2}`
                                : null,
                              row.player.goals2025 > 0
                                ? `Ed.3: ${row.player.goals2025}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 rounded-xl bg-[#0A1B42]/85 px-3 py-1.5">
                    <span className="text-base font-black tabular-nums text-[#F0C46B]">
                      {row.goals}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-blue-200/70">
                      {row.goals === 1 ? "gol" : "goles"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. TABLA DE ASISTIDORES */}
      {activeTab === "asistidores" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <HandHelping className="h-4 w-4 text-[#D49B35]" />
                Tabla de Asistidores
              </span>
              <Badge variant="gold">
                {scope === "all" ? "Histórico 2024–2026" : "Solo 2026"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topAssisters.length === 0 ? (
              <p className="py-8 text-center text-sm text-blue-100/75">
                Todavía no hay asistencias registradas. Al cargar un gol en la planilla en vivo, elegí el asistidor para sumar aquí.
              </p>
            ) : (
              topAssisters.map((row, idx) => (
                <div
                  key={row.player.id}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                    idx === 0
                      ? "border border-[#D49B35]/55 bg-[#D49B35]/15"
                      : "bg-[#16357A]/45"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black text-blue-100">
                      {idx + 1}
                    </span>
                    <PlayerAvatar
                      name={row.player.name}
                      photoUrl={row.player.photoUrl}
                      stars={row.player.stars}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {row.player.name}{" "}
                        {row.player.stars > 0 && (
                          <span className="text-[#D49B35]">
                            {formatStars(row.player.stars)}
                          </span>
                        )}
                      </p>
                      {row.teamName && (
                        <p className="text-[11px] text-blue-200/75">
                          {row.teamName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0A1B42]/85 px-3 py-1.5 text-base font-black tabular-nums text-[#F0C46B]">
                    {row.assists}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
