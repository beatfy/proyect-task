import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ID using crypto.randomUUID().
 * Replaces the previous cuid() implementation for better uniqueness guarantees.
 */
export function cuid(): string {
  return crypto.randomUUID();
}