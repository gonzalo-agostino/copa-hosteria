import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-2xl border border-white/14 bg-[#091A42]/80 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(2,8,24,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col space-y-1 p-4 pb-3 sm:p-5 sm:pb-3.5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "text-base sm:text-lg font-extrabold tracking-tight text-white",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-xs sm:text-sm text-blue-100/80 leading-relaxed", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "p-4 sm:p-5 [[data-slot=card-header]+&]:pt-0 [[data-slot=card-header]+&]:sm:pt-0",
        className
      )}
      {...props}
    />
  );
}
