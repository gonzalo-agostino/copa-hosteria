import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-tight transition-colors",
  {
    variants: {
      variant: {
        gold: "bg-[#D49B35]/20 text-[#F5CE78] border border-[#D49B35]/50",
        blue: "bg-blue-500/20 text-blue-100 border border-blue-400/35",
        live: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/45",
        danger: "bg-red-500/20 text-red-100 border border-red-400/45",
        warning: "bg-amber-400/20 text-amber-100 border border-amber-400/45",
        muted: "bg-white/10 text-blue-100/90 border border-white/15",
      },
    },
    defaultVariants: {
      variant: "blue",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
