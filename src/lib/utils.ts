import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStars(stars: number): string {
  if (stars <= 0) return "";
  return "★".repeat(stars);
}
