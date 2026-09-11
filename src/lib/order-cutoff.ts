import { ORDER_CUTOFF_HOUR_AR } from "@/lib/argentina-time";

/**
 * Pause switch for order-batch cutoff (admin hour + delivery min rules).
 *
 * `false` (current): same-day delivery allowed; no past days; Cotizaciones
 * config tab hidden; admin “después del cierre” grouping off.
 * Flip to `true` to restore previous behavior without rewriting callers.
 */
export const ORDER_CUTOFF_ENFORCEMENT_ENABLED = false;

export function isOrderCutoffEnforced(): boolean {
  return ORDER_CUTOFF_ENFORCEMENT_ENABLED;
}

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
