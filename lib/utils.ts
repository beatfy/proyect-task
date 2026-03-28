import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple cuid-like ID generator
let cuidCounter = 0;
export function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  cuidCounter++;
  const counter = cuidCounter.toString(36);
  return `c${timestamp}${random}${counter}`;
}