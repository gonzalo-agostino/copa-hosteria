import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold tracking-tight transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5CE78]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#091A42] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[#E5B049] to-[#C98E29] text-[#071433] hover:from-[#F0BF5E] hover:to-[#D69B33] shadow-md shadow-[#D49B35]/25",
        secondary:
          "bg-[#173982] text-white border border-white/18 hover:bg-[#1E479E] hover:border-white/28 shadow-sm shadow-black/25",
        outline:
          "border border-[#D49B35]/60 bg-[#0A1D47]/70 text-[#F5CE78] hover:bg-[#D49B35]/18 hover:border-[#F5CE78]/80",
        ghost: "text-blue-100/85 hover:bg-white/10 hover:text-white",
        destructive:
          "bg-gradient-to-b from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 shadow-md shadow-red-950/40",
        success:
          "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-md shadow-emerald-950/40",
        warning:
          "bg-gradient-to-b from-amber-300 to-amber-400 text-[#071433] hover:from-amber-200 hover:to-amber-300 shadow-md shadow-amber-950/30",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-4 sm:px-5 text-sm sm:text-[15px]",
        xl: "h-14 rounded-2xl px-5 sm:px-6 text-base font-extrabold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
