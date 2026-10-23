/** Client-safe types/helpers for admin quote activity chart. */

export type QuoteActivityPeriod = "week" | "month" | "year";

export type QuoteActivityPoint = {
  key: string;
  label: string;
  quotes: number;
  revenue: number;
  /** Inclusive Argentina calendar day `YYYY-MM-DD`. */
  desde?: string;
  /** Inclusive Argentina calendar day `YYYY-MM-DD`. */
  hasta?: string;
};

export type QuoteActivityPeriodLabels = {
  short: string;
  summary: string;
  description: string;
  empty: string;
};

export const QUOTE_ACTIVITY_PERIOD_LABELS: Record<
  QuoteActivityPeriod,
  QuoteActivityPeriodLabels
> = {
  week: {
    short: "Semana",
    summary: "semana",
    description:
      "Totales de cotizaciones por día (semana calendario lun–dom, hora Argentina)",
    empty: "Sin cotizaciones en la semana calendario actual.",
  },
  month: {
    short: "Mes",
    summary: "mes",
    description:
      "Totales de cotizaciones por día (mes calendario actual, hora Argentina)",
    empty: "Sin cotizaciones en el mes calendario actual.",
  },
  year: {
    short: "Año",
    summary: "año",
    description: "Totales de cotizaciones por mes (año calendario actual, hora Argentina)",
    empty: "Sin cotizaciones en el año calendario actual.",
  },
};

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Inclusive Argentina calendar-day range for UI, e.g. `1–31 oct 2026`.
 * Same month/year → compact day–day + month; else full short dates.
 */
export function formatQuoteActivityDayRange(
  desdeYmd: string,
  hastaYmd: string,
): string {
  const a = YMD_RE.exec(desdeYmd);
  const b = YMD_RE.exec(hastaYmd);
  if (!a || !b) return `${desdeYmd} – ${hastaYmd}`;

  const d0 = new Date(Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]), 12));
  const d1 = new Date(Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]), 12));
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) {
    return `${desdeYmd} – ${hastaYmd}`;
  }

  const day0 = Number(a[3]);
  const day1 = Number(b[3]);
  const sameMonth = a[1] === b[1] && a[2] === b[2];

  if (sameMonth) {
    const monthYear = d0
      .toLocaleDateString("es-AR", { month: "short", year: "numeric", timeZone: "UTC" })
      .replace(".", "");
    if (day0 === day1) return `${day0} ${monthYear}`;
    return `${day0}–${day1} ${monthYear}`;
  }

  const fmt = (d: Date) =>
    d
      .toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
      .replace(/\./g, "");
  return `${fmt(d0)} – ${fmt(d1)}`;
}

/** Labels for the activity card; week/month use the bucket range when present. */
export function resolveQuoteActivityLabels(
  period: QuoteActivityPeriod,
  points: QuoteActivityPoint[],
): QuoteActivityPeriodLabels {
  const base = QUOTE_ACTIVITY_PERIOD_LABELS[period];
  if (period !== "week" && period !== "month") return base;

  const first = points[0];
  const last = points[points.length - 1];
  const desde = first?.desde;
  const hasta = last?.hasta ?? last?.desde;
  if (!desde || !hasta) return base;

  const range = formatQuoteActivityDayRange(desde, hasta);
  return {
    ...base,
    summary: range,
    description: `Totales de cotizaciones por día (${range}, hora Argentina)`,
    empty: `Sin cotizaciones en ${range}.`,
  };
}

export function parseQuoteActivityPeriod(value?: string): QuoteActivityPeriod {
  if (value === "month") return "month";
  if (value === "year") return "year";
  return "week";
}

/** Collapse calendar-month day points into ~4 weeks for mobile month view. */
export function aggregateQuoteActivityIntoWeeks(
  points: QuoteActivityPoint[],
): QuoteActivityPoint[] {
  if (points.length === 0) return [];

  const weekCount = Math.min(4, points.length);
  const baseSize = Math.floor(points.length / weekCount);
  const remainder = points.length % weekCount;
  const weeks: QuoteActivityPoint[] = [];
  let start = 0;

  for (let index = 0; index < weekCount; index++) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const slice = points.slice(start, start + size);
    if (slice.length === 0) break;

    weeks.push({
      key: `week-${index + 1}`,
      label: `Sem ${index + 1}`,
      quotes: slice.reduce((sum, point) => sum + point.quotes, 0),
      revenue: slice.reduce((sum, point) => sum + point.revenue, 0),
      desde: slice[0]?.desde,
      hasta: slice[slice.length - 1]?.hasta ?? slice[slice.length - 1]?.desde,
    });

    start += size;
  }

  return weeks;
}

/**
 * Inclusive calendar-day range for cotizaciones filters (`from`/`to` as YMD).
 *
 * Build the query string with raw `YYYY-MM-DD` (do not use URLSearchParams).
 * Percent-encoding has caused soft-nav to land with the URL bar updated while
 * the cotizaciones page fell back to the default range.
 */
export function buildAdminQuotesHrefFromActivityPoint(
  point: QuoteActivityPoint,
): string | null {
  if (!point.desde || point.quotes <= 0) return null;

  const endDay = point.hasta ?? point.desde;
  return `/admin/cotizaciones?from=${point.desde}&to=${endDay}`;
}
