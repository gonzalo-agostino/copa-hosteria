import React from "react";
import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  name: string;
  color: string;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  label?: string | number;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<TeamBadgeProps["size"]>, string> = {
  xs: "h-3.5 w-3.5 text-[8px]",
  sm: "h-5 w-5 text-[10px]",
  md: "h-7 w-7 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-12 w-12 text-base",
};

export function TeamBadge({
  name,
  color,
  imageUrl,
  size = "sm",
  label,
  className,
}: TeamBadgeProps) {
  if (imageUrl) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-[#0A1B42] shadow-sm",
          SIZE_CLASSES[size],
          className
        )}
        style={{
          borderColor: color === "#F8FAFC" ? "#F5CE78" : color,
        }}
        title={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white font-extrabold text-white shadow-sm",
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {label ?? null}
    </span>
  );
}
