"use client";

import React, { useState } from "react";
import { Lock, Unlock, Delete, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ORGANIZER_PIN } from "@/lib/seed";

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
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError(false);

    if (next.length === 4) {
      if (next === ORGANIZER_PIN) {
        onUnlock();
        setPin("");
        onOpenChange(false);
      } else {
        setError(true);
        setTimeout(() => {
          setPin("");
        }, 450);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          setPin("");
          setError(false);
        }
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOrganizer ? (
              <ShieldCheck className="h-5 w-5 text-[#D49B35]" />
            ) : (
              <Lock className="h-5 w-5 text-[#D49B35]" />
            )}
            {isOrganizer ? "Modo Organizador Activo" : "Acceso Organizador"}
          </DialogTitle>
          <DialogDescription>
            {isOrganizer
              ? "Podés gestionar el sorteo, crear partidos y cargar eventos en vivo."
              : "Ingresá el PIN de 4 dígitos para desbloquear el panel de organizador."}
          </DialogDescription>
        </DialogHeader>

        {isOrganizer ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#D49B35]/30 bg-[#D49B35]/10 p-3.5 text-sm text-[#F0C46B]">
              Modo Organizador desbloqueado. Volvé a Vista Pública cuando termines de cargar la fecha.
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
                      error
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

            {error && (
              <p className="text-center text-xs font-semibold text-red-300">
                PIN incorrecto. Probá nuevamente.
              </p>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="h-14 rounded-2xl border border-white/12 bg-[#16357A]/70 text-xl font-bold text-white transition active:scale-95 hover:bg-[#1D4396]"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPin("");
                  setError(false);
                }}
                className="h-14 rounded-2xl border border-white/10 bg-[#0A1B42]/70 text-xs font-semibold text-blue-200/80 transition active:scale-95 hover:bg-white/10"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => handleDigit("0")}
                className="h-14 rounded-2xl border border-white/12 bg-[#16357A]/70 text-xl font-bold text-white transition active:scale-95 hover:bg-[#1D4396]"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Borrar dígito"
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0A1B42]/70 text-blue-200 transition active:scale-95 hover:bg-white/10"
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
