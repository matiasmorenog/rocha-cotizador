import { ORDER_CUTOFF_HOUR_AR } from "@/lib/argentina-time";

/** Valid range for configurable order cutoff (Argentina wall hour, on the hour). */
export const ORDER_CUTOFF_HOUR_MIN = 0;
export const ORDER_CUTOFF_HOUR_MAX = 23;

export function normalizeOrderCutoffHourAr(
  value: unknown,
  fallback = ORDER_CUTOFF_HOUR_AR,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (
    !Number.isInteger(n) ||
    n < ORDER_CUTOFF_HOUR_MIN ||
    n > ORDER_CUTOFF_HOUR_MAX
  ) {
    return fallback;
  }
  return n;
}

export function formatOrderCutoffHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
