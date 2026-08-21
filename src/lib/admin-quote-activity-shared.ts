/** Client-safe types/helpers for admin quote activity chart. */

import { addCalendarDaysYmd } from "@/lib/delivery-date";

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

export const QUOTE_ACTIVITY_PERIOD_LABELS: Record<
  QuoteActivityPeriod,
  { short: string; summary: string; description: string; empty: string }
> = {
  week: {
    short: "Semana",
    summary: "7 días",
    description: "Totales de cotizaciones por día (últimos 7 días, hora Argentina)",
    empty: "Sin cotizaciones en los últimos 7 días.",
  },
  month: {
    short: "Mes",
    summary: "30 días",
    description: "Totales de cotizaciones por día (últimos 30 días, hora Argentina)",
    empty: "Sin cotizaciones en los últimos 30 días.",
  },
  year: {
    short: "Año",
    summary: "año",
    description: "Totales de cotizaciones por mes (año calendario actual, hora Argentina)",
    empty: "Sin cotizaciones en el año calendario actual.",
  },
};

export function parseQuoteActivityPeriod(value?: string): QuoteActivityPeriod {
  if (value === "month") return "month";
  if (value === "year") return "year";
  return "week";
}

/** Collapse ~30 day points into ~4 weeks for mobile month view. */
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
 * Half-open `[desde 00:00, hasta+1 00:00)` Argentina wall time for cotizaciones filters.
 *
 * Build the query string with raw `YYYY-MM-DDTHH:mm` (do not use URLSearchParams).
 * Percent-encoding `:` as `%3A` has caused soft-nav to land with the URL bar
 * updated while the cotizaciones page fell back to the default range.
 */
export function buildAdminQuotesHrefFromActivityPoint(
  point: QuoteActivityPoint,
): string | null {
  if (!point.desde || point.quotes <= 0) return null;

  const endDay = point.hasta ?? point.desde;
  const from = `${point.desde}T00:00`;
  const to = `${addCalendarDaysYmd(endDay, 1)}T00:00`;
  return `/admin/cotizaciones?from=${from}&to=${to}`;
}
