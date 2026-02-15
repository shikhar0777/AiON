// ── Utility functions ────────────────────────────────────────────

import { formatDistanceToNow, parseISO } from "date-fns";

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  try {
    const date = parseISO(dateStr);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trim() + "…";
}

export function categoryColor(category: string): string {
  // Monochrome: all categories use the same B&W treatment
  return "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]";
}

export function scoreGradient(score: number): string {
  // Not used in B&W theme, kept for API compat
  return "from-neutral-800 to-neutral-500";
}
