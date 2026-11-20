import React from "react";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  name: string;
  photoUrl?: string | null;
  stars?: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayerAvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-20 w-20 text-xl",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function PlayerAvatar({
  name,
  photoUrl,
  stars = 0,
  size = "sm",
  className,
}: PlayerAvatarProps) {
  const borderClass =
    stars > 0
      ? "border-[#D49B35] ring-1 ring-[#D49B35]/40"
      : "border-white/20";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-2 bg-[#16357A] flex items-center justify-center font-extrabold text-[#F0C46B]",
        SIZE_CLASSES[size],
        borderClass,
        className
      )}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
