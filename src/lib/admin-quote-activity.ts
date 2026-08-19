import { unstable_cache } from "next/cache";
import {
  ARGENTINA_TZ,
  parseArgentinaDateTime,
  toArgentinaDatetimeLocal,
} from "@/lib/argentina-time";
import { CACHE_TAGS } from "@/lib/cache-tag-names";
import { db } from "@/lib/db";
import {
  parseQuoteActivityPeriod,
  type QuoteActivityPeriod,
  type QuoteActivityPoint,
} from "@/lib/admin-quote-activity-shared";

export type {
  QuoteActivityPeriod,
  QuoteActivityPoint,
} from "@/lib/admin-quote-activity-shared";
export {
  QUOTE_ACTIVITY_PERIOD_LABELS,
  parseQuoteActivityPeriod,
  aggregateQuoteActivityIntoWeeks,
  buildAdminQuotesHrefFromActivityPoint,
} from "@/lib/admin-quote-activity-shared";

export type QuoteActivitySeries = {
  period: QuoteActivityPeriod;
  points: QuoteActivityPoint[];
  totalQuotes: number;
  totalRevenue: number;
};

type ActivityGrain = "day" | "month";

function argentinaDayKey(d = new Date()): string {
  return toArgentinaDatetimeLocal(d).slice(0, 10);
}

function argentinaDayStart(day: string): Date {
  const start = parseArgentinaDateTime(`${day}T00:00`);
  if (!start) throw new Error(`Invalid Argentina day key: ${day}`);
  return start;
}

/** Shift Argentina calendar day by `delta` days (noon anchor, no DST). */
function shiftArgentinaDay(day: string, delta: number): string {
  const noon = parseArgentinaDateTime(`${day}T12:00`);
  if (!noon) throw new Error(`Invalid Argentina day key: ${day}`);
  return toArgentinaDatetimeLocal(
    new Date(noon.getTime() + delta * 24 * 60 * 60 * 1000),
  ).slice(0, 10);
}

function weekdayShortLabel(day: string): string {
  const noon = parseArgentinaDateTime(`${day}T12:00`);
  if (!noon) return day;
  return noon
    .toLocaleDateString("es-AR", {
      timeZone: ARGENTINA_TZ,
      weekday: "short",
    })
    .replace(".", "");
}

function dayOfMonthLabel(day: string): string {
  return String(Number(day.slice(8, 10)));
}

function monthShortLabel(yearMonth: string): string {
  const noon = parseArgentinaDateTime(`${yearMonth}-15T12:00`);
  if (!noon) return yearMonth;
  return noon
    .toLocaleDateString("es-AR", {
      timeZone: ARGENTINA_TZ,
      month: "short",
    })
    .replace(".", "");
}

/** Last calendar day of `YYYY-MM` as `YYYY-MM-DD`. */
function lastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(days).padStart(2, "0")}`;
}

function buildBuckets(
  period: QuoteActivityPeriod,
  todayKey: string,
): {
  buckets: QuoteActivityPoint[];
  rangeStart: Date;
  grain: ActivityGrain;
} {
  if (period === "year") {
    const year = todayKey.slice(0, 4);
    const buckets: QuoteActivityPoint[] = [];

    for (let month = 1; month <= 12; month++) {
      const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
      buckets.push({
        key: yearMonth,
        label: monthShortLabel(yearMonth),
        quotes: 0,
        revenue: 0,
        desde: `${yearMonth}-01`,
        hasta: lastDayOfMonth(yearMonth),
      });
    }

    return {
      buckets,
      rangeStart: argentinaDayStart(`${year}-01-01`),
      grain: "month",
    };
  }

  const dayCount = period === "week" ? 7 : 30;
  const startKey = shiftArgentinaDay(todayKey, -(dayCount - 1));
  const buckets: QuoteActivityPoint[] = [];

  for (let i = 0; i < dayCount; i++) {
    const key = shiftArgentinaDay(startKey, i);
    buckets.push({
      key,
      label: period === "week" ? weekdayShortLabel(key) : dayOfMonthLabel(key),
      quotes: 0,
      revenue: 0,
      desde: key,
      hasta: key,
    });
  }

  return { buckets, rangeStart: argentinaDayStart(startKey), grain: "day" };
}

async function fetchQuoteActivityRows(rangeStart: Date, grain: ActivityGrain) {
  if (grain === "month") {
    return db.$queryRaw<{ bucketKey: string; quotes: number; revenue: number }[]>`
      SELECT
        to_char(
          (q."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'),
          'YYYY-MM'
        ) AS "bucketKey",
        COUNT(*)::int AS quotes,
        COALESCE(SUM(q.total), 0)::float AS revenue
      FROM "Quote" q
      WHERE q."createdAt" >= ${rangeStart}
      GROUP BY 1
    `;
  }

  return db.$queryRaw<{ bucketKey: string; quotes: number; revenue: number }[]>`
    SELECT
      to_char(
        (q."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'),
        'YYYY-MM-DD'
      ) AS "bucketKey",
      COUNT(*)::int AS quotes,
      COALESCE(SUM(q.total), 0)::float AS revenue
    FROM "Quote" q
    WHERE q."createdAt" >= ${rangeStart}
    GROUP BY 1
  `;
}

function fillBuckets(
  buckets: QuoteActivityPoint[],
  rows: { bucketKey: string; quotes: number; revenue: number }[],
  period: QuoteActivityPeriod,
): QuoteActivitySeries {
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const row of rows) {
    const bucket = map.get(row.bucketKey);
    if (!bucket) continue;
    bucket.quotes = row.quotes;
    bucket.revenue = row.revenue;
  }

  return {
    period,
    points: buckets,
    totalQuotes: buckets.reduce((sum, b) => sum + b.quotes, 0),
    totalRevenue: buckets.reduce((sum, b) => sum + b.revenue, 0),
  };
}

/**
 * Quote activity series for the dashboard chart.
 * Cache key args: Argentina day + period (`week` | `month` | `year`).
 * Key prefix `admin-quote-activity`; tag `admin-dashboard` (bust on quote create / wipe).
 */
const getCachedQuoteActivity = unstable_cache(
  async (day: string, period: QuoteActivityPeriod): Promise<QuoteActivitySeries> => {
    const { buckets, rangeStart, grain } = buildBuckets(period, day);
    const rows = await fetchQuoteActivityRows(rangeStart, grain);
    return fillBuckets(buckets, rows, period);
  },
  ["admin-quote-activity"],
  { tags: [CACHE_TAGS.adminDashboard], revalidate: 86400 },
);

export function getAdminQuoteActivity(
  periodInput?: string,
): Promise<QuoteActivitySeries> {
  const period = parseQuoteActivityPeriod(periodInput);
  return getCachedQuoteActivity(argentinaDayKey(), period);
}
