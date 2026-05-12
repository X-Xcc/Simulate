import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function sanitizeImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  console.warn('sanitizeImageUrl blocked unsafe URL:', url.substring(0, 50));
  return '';
}
