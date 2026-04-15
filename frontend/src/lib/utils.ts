import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sentimentColor(label: string): string {
  if (label === "positive") return "text-emerald-600";
  if (label === "negative") return "text-red-500";
  return "text-amber-500";
}

export function sentimentBg(label: string): string {
  if (label === "positive") return "bg-emerald-50 text-emerald-700";
  if (label === "negative") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}
