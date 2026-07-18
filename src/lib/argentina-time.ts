/**
 * America/Argentina/Buenos_Aires helpers (UTC−3 year-round, no DST).
 *
 * Datetime-local strings (`YYYY-MM-DDTHH:mm`) and API `from`/`to` query values
 * in that shape are always interpreted as wall time in this timezone — not the
 * server TZ and not the browser TZ. Convert to UTC `Date` for DB comparisons.
 */

export const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

/** Argentina offset used when parsing naive local datetimes. */
const ARGENTINA_OFFSET = "-03:00";

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parse `YYYY-MM-DDTHH:mm` (or with seconds) as America/Argentina/Buenos_Aires
 * wall time → UTC `Date`. Also accepts full ISO with `Z` / offset.
 */
export function parseArgentinaDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const local = DATETIME_LOCAL_RE.exec(trimmed);
  if (local) {
    const [, y, mo, d, h, mi, s] = local;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}${ARGENTINA_OFFSET}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a UTC instant as `YYYY-MM-DDTHH:mm` in Argentina (for datetime-local). */
export function toArgentinaDatetimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Format for export / UI display in Argentina. */
export function formatArgentinaDateTime(date: Date): string {
  return date.toLocaleString("es-AR", { timeZone: ARGENTINA_TZ });
}

/**
 * Default export window: yesterday 16:00 → today 16:00 (Argentina).
 * Half-open interval: [from, to).
 */
export function defaultQuotesExportRange(now = new Date()): {
  from: Date;
  to: Date;
  fromLocal: string;
  toLocal: string;
} {
  const localNow = toArgentinaDatetimeLocal(now);
  const [datePart] = localNow.split("T");
  const toLocal = `${datePart}T16:00`;
  const to = parseArgentinaDateTime(toLocal)!;

  // Yesterday same 16:00 (Argentina has no DST — 24h subtract is safe)
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const fromLocal = toArgentinaDatetimeLocal(from);

  return { from, to, fromLocal, toLocal };
}

/** Resolve from/to params; fall back to default range. Invalid → null for that side uses default. */
export function resolveQuotesExportRange(
  fromParam: string | undefined | null,
  toParam: string | undefined | null,
  now = new Date(),
): { from: Date; to: Date; fromLocal: string; toLocal: string } {
  const defaults = defaultQuotesExportRange(now);
  const from = fromParam ? parseArgentinaDateTime(fromParam) : null;
  const to = toParam ? parseArgentinaDateTime(toParam) : null;

  const resolvedFrom = from ?? defaults.from;
  const resolvedTo = to ?? defaults.to;

  return {
    from: resolvedFrom,
    to: resolvedTo,
    fromLocal: toArgentinaDatetimeLocal(resolvedFrom),
    toLocal: toArgentinaDatetimeLocal(resolvedTo),
  };
}
