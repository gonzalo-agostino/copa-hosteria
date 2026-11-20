import React from "react";
import { cn } from "@/lib/utils";

export function CopaCrest({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[#F5CE78]/65 bg-[#143275] shadow-md shadow-[#D49B35]/20 ring-1 ring-black/30",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-copa-hosteria.jpg"
        alt="Escudo oficial Copa Hostería"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
