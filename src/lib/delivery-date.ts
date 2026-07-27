/**
 * Order delivery / fulfillment date helpers (America/Argentina/Buenos_Aires).
 *
 * Cutoff 16:00 AR wall time:
 * - before 16:00 → earliest delivery = tomorrow
 * - at/after 16:00 → earliest delivery = day after tomorrow
 *   (same batch boundary as admin export window: yesterday 16:00 → today 16:00)
 *
 * Customers may pick any date >= earliest (e.g. Monday → Friday).
 */

import { ARGENTINA_TZ } from "@/lib/argentina-time";

export const ORDER_CUTOFF_HOUR_AR = 16;

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function argentinaCalendarParts(now: Date): {
  ymd: string;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const hourRaw = get("hour");
  const hour = Number(hourRaw === "24" ? "0" : hourRaw);
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number.isFinite(hour) ? hour : 0,
  };
}

/** Add calendar days to a `YYYY-MM-DD` string (UTC date arithmetic). */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  const match = YMD_RE.exec(ymd);
  if (!match) throw new Error(`Invalid YMD: ${ymd}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Earliest allowed delivery date as `YYYY-MM-DD` (Argentina calendar).
 * Before 16:00 → +1 day; at/after 16:00 → +2 days.
 */
export function earliestDeliveryDateYmd(now = new Date()): string {
  const { ymd, hour } = argentinaCalendarParts(now);
  const offset = hour < ORDER_CUTOFF_HOUR_AR ? 1 : 2;
  return addCalendarDaysYmd(ymd, offset);
}

/** Parse `YYYY-MM-DD` → UTC midnight `Date` for Prisma `@db.Date`. Invalid → null. */
export function parseDateOnlyYmd(value: string): Date | null {
  const match = YMD_RE.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Format Prisma `@db.Date` (UTC midnight) as `YYYY-MM-DD`. */
export function formatDateOnlyYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Display date-only in es-AR (calendar day, no TZ shift). */
export function formatDeliveryDateDisplay(date: Date): string {
  return date.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

/**
 * Resolve stored delivery date, or infer default from `createdAt` for legacy rows.
 */
export function resolveDeliveryDate(quote: {
  deliveryDate: Date | null;
  createdAt: Date;
}): Date {
  if (quote.deliveryDate) return quote.deliveryDate;
  return parseDateOnlyYmd(earliestDeliveryDateYmd(quote.createdAt))!;
}

/**
 * Validate client-provided YMD: must parse and be >= earliest allowed at `now`.
 */
export function validateDeliveryDateYmd(
  value: string,
  now = new Date(),
): { ok: true; date: Date; ymd: string } | { ok: false; error: string } {
  const date = parseDateOnlyYmd(value);
  if (!date) {
    return { ok: false, error: "Fecha de entrega inválida" };
  }
  const ymd = formatDateOnlyYmd(date);
  const min = earliestDeliveryDateYmd(now);
  if (ymd < min) {
    return {
      ok: false,
      error: `La fecha de entrega no puede ser anterior a ${min}`,
    };
  }
  return { ok: true, date, ymd };
}
