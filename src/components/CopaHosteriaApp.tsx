"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Dices,
  CalendarDays,
  BarChart3,
  Users,
  Lock,
  Unlock,
  RotateCcw,
} from "lucide-react";
import { TournamentDB } from "@/types/tournament";
import { CopaCrest } from "@/components/CopaCrest";
import { OrganizerPinModal } from "@/components/OrganizerPinModal";
import { DrawModule } from "@/components/DrawModule";
import { LiveMatchModule } from "@/components/LiveMatchModule";
import { StatsModule } from "@/components/StatsModule";
import { PlayersRosterModule } from "@/components/PlayersRosterModule";
import { Badge } from "@/components/ui/badge";

interface CopaHosteriaAppProps {
  initialDB: TournamentDB;
}

type MainTab = "sorteo" | "partidos" | "tablas" | "jugadores";

export function CopaHosteriaApp({ initialDB }: CopaHosteriaAppProps) {
  const [db, setDb] = useState<TournamentDB>(initialDB);
  const [activeTab, setActiveTab] = useState<MainTab>("sorteo");
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDB = useCallback((nextDB: TournamentDB) => {
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextDB),
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1400);
      } catch (err) {
        console.error("Failed to save DB:", err);
        setSaveState("idle");
      }
    }, 150);
  }, []);

  const handleUpdateDB = useCallback(
    (updater: (prev: TournamentDB) => TournamentDB) => {
      setDb((prev) => {
        const next = updater(prev);
        persistDB(next);
        return next;
      });
    },
    [persistDB]
  );

  const handleResetAll = async () => {
    if (
      !window.confirm(
        "¿Reiniciar toda la 4° Edición a los datos precargados (42 convocados + histórico 2025)?"
      )
    ) {
      return;
    }
    const res = await fetch("/api/state", { method: "DELETE" });
    if (res.ok) {
      const fresh = (await res.json()) as TournamentDB;
      setDb(fresh);
    }
  };

  const navItems: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: "sorteo", label: "Sorteo", icon: Dices },
    { id: "partidos", label: "Partidos", icon: CalendarDays },
    { id: "tablas", label: "Tablas", icon: BarChart3 },
    { id: "jugadores", label: "Padrón", icon: Users },
  ];

  const liveMatchesCount = db.matches.filter((m) => m.status === "en_vivo").length;

  return (
    <div className="min-h-dvh pb-24 sm:pb-12">
      {/* Sticky Official Header */}
      <header className="sticky top-0 z-40 border-b border-[#D49B35]/35 bg-[#071433]/92 backdrop-blur-xl shadow-lg shadow-black/30">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <CopaCrest className="h-11 w-11 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base sm:text-xl font-black tracking-tight text-white">
                  COPA HOSTERÍA
                </h1>
                {liveMatchesCount > 0 && (
                  <Badge variant="live" className="hidden sm:inline-flex">
                    ● {liveMatchesCount} EN VIVO
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs sm:text-[13px] font-semibold text-[#F5CE78]">
                4° Edición · 28.11.2026
                {saveState === "saving" && (
                  <span className="ml-2 text-blue-100/75">Guardando...</span>
                )}
                {saveState === "saved" && (
                  <span className="ml-2 text-emerald-300">Guardado ✓</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOrganizer && (
              <button
                type="button"
                onClick={handleResetAll}
                title="Restaurar datos precargados"
                className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-blue-100/85 transition hover:bg-white/14 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setPinModalOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer ${
                isOrganizer
                  ? "border-[#F5CE78] bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-md shadow-[#D49B35]/30"
                  : "border-white/22 bg-[#143275]/85 text-white hover:border-[#F5CE78]/70 hover:bg-[#1A3F8F]"
              }`}
            >
              {isOrganizer ? (
                <>
                  <Unlock className="h-3.5 w-3.5 shrink-0" />
                  <span>Organizador</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#F5CE78]" />
                  <span>Vista Pública</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden sm:block border-t border-white/10 bg-[#06112B]/70">
          <div className="mx-auto flex max-w-5xl gap-1.5 px-4 py-2">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition cursor-pointer ${
                    active
                      ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-md shadow-[#D49B35]/25"
                      : "text-blue-100/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-5xl px-3.5 py-5 sm:px-4 sm:py-7">
        {activeTab === "sorteo" && (
          <DrawModule
            db={db}
            isOrganizer={isOrganizer}
            onUpdateDB={handleUpdateDB}
            onRequestOrganizer={() => setPinModalOpen(true)}
          />
        )}

        {activeTab === "partidos" && (
          <LiveMatchModule
            db={db}
            isOrganizer={isOrganizer}
            onUpdateDB={handleUpdateDB}
          />
        )}

        {activeTab === "tablas" && <StatsModule db={db} />}

        {activeTab === "jugadores" && (
          <PlayersRosterModule
            db={db}
            isOrganizer={isOrganizer}
            onReplaceDB={setDb}
            onRequestOrganizer={() => setPinModalOpen(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (One-Handed Thumb Friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D49B35]/35 bg-[#071433]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-4 gap-1.5 px-2.5 py-2">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition active:scale-95 ${
                  active
                    ? "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] shadow-sm shadow-[#D49B35]/30"
                    : "text-blue-100/80 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Organizer PIN Modal */}
      <OrganizerPinModal
        open={pinModalOpen}
        onOpenChange={setPinModalOpen}
        isOrganizer={isOrganizer}
        onUnlock={() => setIsOrganizer(true)}
        onLock={() => setIsOrganizer(false)}
      />
    </div>
  );
}
