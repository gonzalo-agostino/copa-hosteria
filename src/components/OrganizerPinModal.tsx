"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Lock, Unlock, Delete, ShieldCheck, ShieldBan, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const LOCAL_BLOCK_KEY = "copa_hosteria_org_blocked_v1";

interface AttemptEntry {
  ip: string;
  count: number;
  blocked: boolean;
  lastAttemptAt: string;
}

interface OrganizerPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOrganizer: boolean;
  onUnlock: () => void;
  onLock: () => void;
}

export function OrganizerPinModal({
  open,
  onOpenChange,
  isOrganizer,
  onUnlock,
  onLock,
}: OrganizerPinModalProps) {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [blockedCount, setBlockedCount] = useState(0);
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;

    const checkStatus = async () => {
      setChecking(true);
      try {
        const localBlocked =
          typeof window !== "undefined" &&
          window.localStorage.getItem(LOCAL_BLOCK_KEY) === "1";

        const res = await fetch("/api/organizer/auth", { cache: "no-store" });
        if (res.ok && active) {
          const data = (await res.json()) as {
            blocked?: boolean;
            remainingAttempts?: number;
            blockedCount?: number;
            attempts?: AttemptEntry[];
          };
          const serverBlocked = Boolean(data.blocked);
          setBlockedCount(data.blockedCount ?? 0);
          setAttempts(data.attempts ?? []);

          if (serverBlocked) {
            setIsBlocked(true);
            setRemainingAttempts(0);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(LOCAL_BLOCK_KEY, "1");
            }
          } else if (localBlocked && !isOrganizer) {
            setIsBlocked(true);
            setRemainingAttempts(0);
          } else {
            setIsBlocked(false);
            setRemainingAttempts(data.remainingAttempts ?? 3);
          }
        }
      } catch {
        // fallback to local check only
        if (
          active &&
          typeof window !== "undefined" &&
          window.localStorage.getItem(LOCAL_BLOCK_KEY) === "1"
        ) {
          setIsBlocked(true);
          setRemainingAttempts(0);
        }
      } finally {
        if (active) setChecking(false);
      }
    };

    checkStatus();
    return () => {
      active = false;
    };
  }, [open, isOrganizer]);

  const verifyPin = useCallback(
    async (enteredPin: string) => {
      setSubmitting(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/organizer/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: enteredPin }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          blocked?: boolean;
          remainingAttempts?: number;
        };

        if (res.ok && data.ok) {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(LOCAL_BLOCK_KEY);
          }
          onUnlock();
          setPin("");
          setErrorMsg(null);
          onOpenChange(false);
          return;
        }

        const left = data.remainingAttempts ?? 0;
        setRemainingAttempts(left);

        if (data.blocked || left <= 0) {
          setIsBlocked(true);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LOCAL_BLOCK_KEY, "1");
          }
          setErrorMsg(null);
        } else {
          setErrorMsg(
            left === 1
              ? "PIN incorrecto. Te queda 1 último intento."
              : `PIN incorrecto. Te quedan ${left} intentos.`
          );
        }

        setTimeout(() => {
          setPin("");
        }, 350);
      } catch {
        setErrorMsg("No se pudo verificar el PIN. Intentá de nuevo.");
        setPin("");
      } finally {
        setSubmitting(false);
      }
    },
    [onOpenChange, onUnlock]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4 || isBlocked || submitting || checking) return;
      const next = pin + digit;
      setPin(next);
      setErrorMsg(null);

      if (next.length === 4) {
        void verifyPin(next);
      }
    },
    [checking, isBlocked, pin, submitting, verifyPin]
  );

  const handleBackspace = useCallback(() => {
    if (submitting) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  }, [submitting]);

  useEffect(() => {
    if (!open || isOrganizer || isBlocked || checking) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Delete") {
        e.preventDefault();
        if (!submitting) {
          setPin("");
          setErrorMsg(null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    open,
    isOrganizer,
    isBlocked,
    checking,
    submitting,
    handleDigit,
    handleBackspace,
  ]);

  const handleClearBlockedDevices = async () => {
    const res = await fetch("/api/organizer/auth", { method: "DELETE" });
    if (res.ok) {
      setBlockedCount(0);
      setAttempts([]);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LOCAL_BLOCK_KEY);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          setPin("");
          setErrorMsg(null);
        }
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOrganizer ? (
              <ShieldCheck className="h-5 w-5 text-[#D49B35]" />
            ) : isBlocked ? (
              <ShieldBan className="h-5 w-5 text-red-400" />
            ) : (
              <Lock className="h-5 w-5 text-[#D49B35]" />
            )}
            {isOrganizer
              ? "Modo Organizador Activo"
              : isBlocked
                ? "Acceso Bloqueado"
                : "Acceso Organizador"}
          </DialogTitle>
          <DialogDescription>
            {isOrganizer
              ? "Podés gestionar el sorteo, editar jugadores, cargar fotos y registrar partidos en vivo."
              : isBlocked
                ? "Se superó el límite de 3 intentos fallidos."
                : "Ingresá el PIN de 4 dígitos para desbloquear el panel de organizador."}
          </DialogDescription>
        </DialogHeader>

        {isOrganizer ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#D49B35]/30 bg-[#D49B35]/10 p-3.5 text-sm text-[#F0C46B]">
              Modo Organizador desbloqueado. Volvé a Vista Pública cuando termines de cargar la fecha.
            </div>

            {/* Failed PIN Attempts Audit List */}
            <div className="rounded-2xl border border-white/12 bg-[#071433]/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-100/90">
                  Intentos fallidos de PIN
                </p>
                <span className="text-[11px] font-semibold text-[#F5CE78]">
                  {attempts.length} reg. · {blockedCount} bloq.
                </span>
              </div>

              {attempts.length === 0 ? (
                <p className="text-xs text-blue-200/60">
                  Nadie intentó ingresar con un PIN incorrecto todavía.
                </p>
              ) : (
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {attempts.map((a) => (
                    <div
                      key={a.ip}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#143275]/45 px-2.5 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono font-bold text-white">
                          {a.ip}
                        </p>
                        <p className="text-[10px] text-blue-200/70">
                          {new Date(a.lastAttemptAt).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          a.blocked
                            ? "bg-red-500/25 text-red-200 border border-red-400/40"
                            : "bg-amber-400/20 text-amber-200 border border-amber-400/35"
                        }`}
                      >
                        {a.blocked ? "BLOQUEADO (3/3)" : `${a.count}/3 fallos`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {attempts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleClearBlockedDevices}
                >
                  Limpiar registro y desbloquear todos
                </Button>
              )}
            </div>

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                onLock();
                onOpenChange(false);
              }}
            >
              <Lock className="h-4 w-4" />
              Bloquear y volver a Vista Pública
            </Button>
          </div>
        ) : checking ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-xs text-blue-200/75">
            <Loader2 className="h-6 w-6 animate-spin text-[#D49B35]" />
            <span>Verificando acceso...</span>
          </div>
        ) : isBlocked ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-400/50 bg-red-950/60 p-4 text-sm text-red-100 space-y-2">
              <p className="font-bold text-red-200">
                Máximo de intentos alcanzado (3/3)
              </p>
              <p className="text-xs leading-relaxed text-red-100/85">
                Por seguridad, este dispositivo/conexión quedó bloqueado de forma permanente para el acceso de organizador. Podés seguir usando la aplicación en <strong>Vista Pública</strong>.
              </p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Volver a Vista Pública
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* PIN Dots */}
            <div className="flex justify-center gap-3.5 py-2">
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length;
                return (
                  <div
                    key={i}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-xl font-bold transition-all ${
                      errorMsg
                        ? "border-red-500 bg-red-500/20 text-red-200"
                        : filled
                          ? "border-[#D49B35] bg-[#D49B35]/20 text-[#F0C46B]"
                          : "border-white/20 bg-[#0A1B42]/70 text-white/30"
                    }`}
                  >
                    {filled ? "●" : ""}
                  </div>
                );
              })}
            </div>

            {errorMsg ? (
              <p className="text-center text-xs font-semibold text-red-300">
                {errorMsg}
              </p>
            ) : (
              <p className="text-center text-xs text-blue-200/70">
                Intentos disponibles: <strong className="text-[#F0C46B]">{remainingAttempts} / 3</strong>
              </p>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDigit(d)}
                  className="h-14 rounded-2xl border border-white/12 bg-[#16357A]/70 text-xl font-bold text-white transition active:scale-95 hover:bg-[#1D4396] disabled:opacity-50"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setPin("");
                  setErrorMsg(null);
                }}
                className="h-14 rounded-2xl border border-white/10 bg-[#0A1B42]/70 text-xs font-semibold text-blue-200/80 transition active:scale-95 hover:bg-white/10 disabled:opacity-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDigit("0")}
                className="h-14 rounded-2xl border border-white/12 bg-[#16357A]/70 text-xl font-bold text-white transition active:scale-95 hover:bg-[#1D4396] disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleBackspace}
                aria-label="Borrar dígito"
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0A1B42]/70 text-blue-200 transition active:scale-95 hover:bg-white/10 disabled:opacity-50"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-blue-200/60">
              <Unlock className="h-3.5 w-3.5 text-[#D49B35]" />
              <span>Acceso exclusivo para organizadores</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
