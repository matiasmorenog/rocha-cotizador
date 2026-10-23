/**
 * America/Argentina/Buenos_Aires helpers (UTC−3 year-round, no DST).
 *
 * Datetime-local strings (`YYYY-MM-DDTHH:mm`) and API `from`/`to` query values
 * in that shape are always interpreted as wall time in this timezone — not the
 * server TZ and not the browser TZ. Convert to UTC `Date` for DB comparisons.
 */

export const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

/** Live end-of-range sentinel for datetime filters (display: "Ahora"). */
export const DATETIME_FILTER_NOW = "now";

/** Order / export batch closing hour (Argentina wall time). */
export const ORDER_CUTOFF_HOUR_AR = 16;

/**
 * @deprecated Prefer calendar presets (`thisWeekFilterDateRange`). Kept for
 * callers that still want a rolling inclusive day window.
 */
export const FILTER_DEFAULT_RANGE_DAYS = 7;

/**
 * @deprecated Prefer `thisMonthFilterDateRange` / `previousMonthFilterDateRange`.
 */
export const FILTER_LAST_MONTH_RANGE_DAYS = 30;

/** Argentina offset used when parsing naive local datetimes. */
const ARGENTINA_OFFSET = "-03:00";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function isDateOnlyYmd(value: string): boolean {
  return DATE_ONLY_RE.test(value.trim());
}

export function argentinaTodayYmd(now = new Date()): string {
  return now
    .toLocaleDateString("en-CA", { timeZone: ARGENTINA_TZ })
    .slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const match = DATE_ONLY_RE.exec(ymd);
  if (!match) throw new Error(`Invalid YMD: ${ymd}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday (matches DateRangePicker grid). */
function mondayIndexFromYmd(ymd: string): number {
  const match = DATE_ONLY_RE.exec(ymd);
  if (!match) throw new Error(`Invalid YMD: ${ymd}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const sun0 = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (sun0 + 6) % 7;
}

function mondayOfWeekContaining(ymd: string): string {
  return addDaysYmd(ymd, -mondayIndexFromYmd(ymd));
}

function lastDayOfMonthYmd(year: number, month1to12: number): string {
  const last = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** Start of calendar day in Argentina (00:00 wall). */
export function parseArgentinaDateOnlyStart(ymd: string): Date | null {
  const trimmed = ymd.trim();
  const match = DATE_ONLY_RE.exec(trimmed);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T00:00:00${ARGENTINA_OFFSET}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Exclusive upper bound for half-open `[from, to)` queries on a calendar day. */
export function parseArgentinaDateOnlyEndExclusive(ymd: string): Date | null {
  const start = parseArgentinaDateOnlyStart(ymd);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function filterDateRange(
  inclusiveDays: number,
  now = new Date(),
): {
  from: string;
  to: string;
} {
  const to = argentinaTodayYmd(now);
  const from = addDaysYmd(to, -(inclusiveDays - 1));
  return { from, to };
}

/** Monday of current week → today (Argentina). */
export function thisWeekFilterDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  const to = argentinaTodayYmd(now);
  return { from: mondayOfWeekContaining(to), to };
}

/** Previous calendar week Monday → Sunday (Argentina). */
export function previousWeekFilterDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  const today = argentinaTodayYmd(now);
  const thisMonday = mondayOfWeekContaining(today);
  const from = addDaysYmd(thisMonday, -7);
  const to = addDaysYmd(thisMonday, -1);
  return { from, to };
}

/** 1st of current month → today (Argentina). */
export function thisMonthFilterDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  const to = argentinaTodayYmd(now);
  const from = `${to.slice(0, 8)}01`;
  return { from, to };
}

/** Previous calendar month 1st → last day (Argentina). */
export function previousMonthFilterDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  const today = argentinaTodayYmd(now);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const prevYear = m === 1 ? y - 1 : y;
  const prevMonth = m === 1 ? 12 : m - 1;
  const from = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const to = lastDayOfMonthYmd(prevYear, prevMonth);
  return { from, to };
}

/** Default admin/customer date filter = esta semana (lun → hoy). */
export function defaultFilterDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  return thisWeekFilterDateRange(now);
}

/**
 * @deprecated Use `thisMonthFilterDateRange`. Previously meant rolling 30 days.
 */
export function lastMonthFilterDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  return thisMonthFilterDateRange(now);
}

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

export function isDatetimeFilterNow(value: string | undefined | null): boolean {
  return value?.trim().toLowerCase() === DATETIME_FILTER_NOW;
}

/**
 * Default quotes list/export window: esta semana (lun → hoy, Argentina),
 * date-only. Half-open interval: [from, to).
 */
export function defaultQuotesExportRange(now = new Date()): {
  from: Date;
  to: Date;
  fromLocal: string;
  toLocal: string;
} {
  const { from: fromYmd, to: toYmd } = thisWeekFilterDateRange(now);
  const from = parseArgentinaDateOnlyStart(fromYmd)!;
  const to = parseArgentinaDateOnlyEndExclusive(toYmd)!;
  return { from, to, fromLocal: fromYmd, toLocal: toYmd };
}

/**
 * Split quotes relative to the closing cutoff on the calendar day of `toLocal`.
 * If `to` is before that day's 16:00, all rows stay in `main` (no late group).
 */
export function splitQuotesByDayCutoff<T extends { createdAt: string | Date }>(
  quotes: T[],
  toLocal: string,
  cutoffHour = ORDER_CUTOFF_HOUR_AR,
): { main: T[]; afterCutoff: T[]; cutoffLocal: string | null } {
  const trimmed = toLocal.trim();
  const dateOnly = isDateOnlyYmd(trimmed);
  const [datePart, timePart = dateOnly ? "23:59" : "00:00"] = dateOnly
    ? [trimmed, "23:59"]
    : trimmed.split("T");
  if (!datePart) {
    return { main: quotes, afterCutoff: [], cutoffLocal: null };
  }

  const [hhRaw, mmRaw] = timePart.split(":");
  const hour = Number(hhRaw);
  const minute = Number(mmRaw ?? "0");
  const cutoffLocal = `${datePart}T${String(cutoffHour).padStart(2, "0")}:00`;

  if (!Number.isFinite(hour) || hour < cutoffHour) {
    return { main: quotes, afterCutoff: [], cutoffLocal: null };
  }
  if (
    !dateOnly &&
    hour === cutoffHour &&
    (!Number.isFinite(minute) || minute === 0)
  ) {
    return { main: quotes, afterCutoff: [], cutoffLocal: null };
  }

  const cutoff = parseArgentinaDateTime(cutoffLocal);
  if (!cutoff) {
    return { main: quotes, afterCutoff: [], cutoffLocal: null };
  }

  const cutoffMs = cutoff.getTime();
  const main: T[] = [];
  const afterCutoff: T[] = [];
  for (const q of quotes) {
    const created =
      q.createdAt instanceof Date ? q.createdAt : new Date(q.createdAt);
    if (created.getTime() >= cutoffMs) afterCutoff.push(q);
    else main.push(q);
  }
  return { main, afterCutoff, cutoffLocal };
}

function resolveFilterBound(
  param: string | undefined | null,
  edge: "start" | "end",
): Date | null {
  const trimmed = param?.trim();
  if (!trimmed) return null;
  if (isDateOnlyYmd(trimmed)) {
    return edge === "start"
      ? parseArgentinaDateOnlyStart(trimmed)
      : parseArgentinaDateOnlyEndExclusive(trimmed);
  }
  return parseArgentinaDateTime(trimmed);
}

function filterBoundToLocal(param: string | undefined | null, date: Date): string {
  const trimmed = param?.trim();
  if (trimmed && isDateOnlyYmd(trimmed)) return trimmed;
  return toArgentinaDatetimeLocal(date);
}

/** Resolve from/to params; fall back to default range. Invalid → null for that side uses default. */
export function resolveQuotesExportRange(
  fromParam: string | undefined | null,
  toParam: string | undefined | null,
  now = new Date(),
): { from: Date; to: Date; fromLocal: string; toLocal: string } {
  const defaults = defaultQuotesExportRange(now);
  const from = resolveFilterBound(fromParam, "start");
  const to = resolveFilterBound(toParam, "end");

  const resolvedFrom = from ?? defaults.from;
  const resolvedTo = to ?? defaults.to;

  return {
    from: resolvedFrom,
    to: resolvedTo,
    fromLocal: from
      ? filterBoundToLocal(fromParam, resolvedFrom)
      : defaults.fromLocal,
    toLocal: to ? filterBoundToLocal(toParam, resolvedTo) : defaults.toLocal,
  };
}
