import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/18 bg-[#08173B]/90 px-3.5 py-2 text-sm font-medium text-white placeholder:text-blue-200/60 shadow-inner shadow-black/20 transition focus-visible:outline-none focus-visible:border-[#D49B35]/80 focus-visible:ring-2 focus-visible:ring-[#D49B35]/40 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
