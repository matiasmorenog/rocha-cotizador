import { unstable_cache } from "next/cache";
import { parseArgentinaDateTime, toArgentinaDatetimeLocal } from "@/lib/argentina-time";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tag-names";

export type AdminDashboardRecentQuote = {
  id: string;
  number: string;
  total: number;
  createdAt: string;
  customer: { code: string; name: string };
};

export type AdminDashboardData = {
  quotesToday: number;
  quotesTodayTotal: number;
  quotesYesterday: number;
  customersQuotedToday: number;
  customersQuotedWeek: number;
  /** All-time lines needing weigh (current / legacy card). */
  pendingWeighLines: number;
  /** TEMP candidate KPIs — strip with UI banner when product picks. */
  deliveriesToday: number;
  pendingWeighLive: number;
  activeCustomersNoQuoteWeek: number;
  submittedQuotesToday: number;
  branchesMissingDesperdicioToday: number;
  recent: AdminDashboardRecentQuote[];
};

type DashboardSqlRow = {
  quotesToday: number;
  quotesTodayTotal: number;
  quotesYesterday: number;
  customersQuotedToday: number;
  customersQuotedWeek: number;
  pendingWeighLines: number;
  deliveriesToday: number;
  pendingWeighLive: number;
  activeCustomersNoQuoteWeek: number;
  submittedQuotesToday: number;
  branchesMissingDesperdicioToday: number;
  recent: unknown;
};

type RecentSqlItem = {
  id: string;
  number: string;
  total: number | string;
  createdAt: string | Date;
  customerCode: string;
  customerName: string;
};

/** Calendar day key in America/Argentina/Buenos_Aires (`YYYY-MM-DD`). */
function argentinaDayKey(d = new Date()): string {
  return toArgentinaDatetimeLocal(d).slice(0, 10);
}

function argentinaDayStart(day: string): Date {
  const start = parseArgentinaDateTime(`${day}T00:00`);
  if (!start) throw new Error(`Invalid Argentina day key: ${day}`);
  return start;
}

/** Monday 00:00 Argentina of the week containing `day` (Mon–Sun). */
function argentinaWeekMondayStart(day: string): Date {
  const noon = parseArgentinaDateTime(`${day}T12:00`);
  if (!noon) throw new Error(`Invalid Argentina day key: ${day}`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
  }).format(noon);
  const dow: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const daysFromMonday = ((dow[weekday] ?? 1) + 6) % 7;
  return new Date(argentinaDayStart(day).getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
}

function shiftYmd(day: string, delta: number): string {
  const noon = parseArgentinaDateTime(`${day}T12:00`);
  if (!noon) throw new Error(`Invalid Argentina day key: ${day}`);
  return toArgentinaDatetimeLocal(
    new Date(noon.getTime() + delta * 24 * 60 * 60 * 1000),
  ).slice(0, 10);
}

function parseRecentJson(raw: unknown): AdminDashboardRecentQuote[] {
  const list: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    const row = item as RecentSqlItem;
    const createdAt =
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString();
    return {
      id: row.id,
      number: row.number,
      total: Number(row.total),
      createdAt,
      customer: { code: row.customerCode, name: row.customerName },
    };
  });
}

function emptyDashboard(): AdminDashboardData {
  return {
    quotesToday: 0,
    quotesTodayTotal: 0,
    quotesYesterday: 0,
    customersQuotedToday: 0,
    customersQuotedWeek: 0,
    pendingWeighLines: 0,
    deliveriesToday: 0,
    pendingWeighLive: 0,
    activeCustomersNoQuoteWeek: 0,
    submittedQuotesToday: 0,
    branchesMissingDesperdicioToday: 0,
    recent: [],
  };
}

/**
 * Dashboard counts + recent quotes in **one** SQL round-trip (CTEs).
 * Includes TEMP candidate KPIs (sets A/B/C) — bump key when stripping.
 * TTL 24h; freshness via `invalidateAfterQuoteCreate` /
 * wipe → `invalidateAfterDbScript` (all tags via POST /api/revalidate).
 */
const getCachedAdminDashboard = unstable_cache(
  async (day: string): Promise<AdminDashboardData> => {
    const startToday = argentinaDayStart(day);
    const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
    const startWeek = argentinaWeekMondayStart(day);
    const start7d = new Date(startToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const quoteScanStart =
      startYesterday.getTime() < startWeek.getTime() ? startYesterday : startWeek;

    const todayDate = parseDateOnlyYmd(day);
    const yesterdayDate = parseDateOnlyYmd(shiftYmd(day, -1));
    if (!todayDate || !yesterdayDate) {
      throw new Error(`Invalid calendar day for dashboard: ${day}`);
    }

    const rows = await db.$queryRaw<DashboardSqlRow[]>`
      WITH kpi AS (
        SELECT
          COUNT(*) FILTER (WHERE q."createdAt" >= ${startToday})::int AS "quotesToday",
          COALESCE(
            SUM(q.total) FILTER (WHERE q."createdAt" >= ${startToday}),
            0
          )::float AS "quotesTodayTotal",
          COUNT(*) FILTER (
            WHERE q."createdAt" >= ${startYesterday}
              AND q."createdAt" < ${startToday}
          )::int AS "quotesYesterday",
          COUNT(DISTINCT q."customerId") FILTER (
            WHERE q."createdAt" >= ${startToday}
          )::int AS "customersQuotedToday",
          COUNT(DISTINCT q."customerId") FILTER (
            WHERE q."createdAt" >= ${startWeek}
          )::int AS "customersQuotedWeek",
          COUNT(*) FILTER (
            WHERE q.status = 'SUBMITTED' AND q."createdAt" >= ${startToday}
          )::int AS "submittedQuotesToday"
        FROM "Quote" q
        WHERE q."createdAt" >= ${quoteScanStart}
      ),
      deliveries AS (
        SELECT COUNT(*)::int AS "deliveriesToday"
        FROM "Quote" q
        WHERE q."deliveryDate" = ${todayDate}
      ),
      pending AS (
        SELECT COUNT(*)::int AS "pendingWeighLines"
        FROM "QuoteItem" qi
        WHERE qi."orderByUnit" = true OR qi."unitPrice" = 0
      ),
      pending_live AS (
        SELECT COUNT(*)::int AS "pendingWeighLive"
        FROM "QuoteItem" qi
        INNER JOIN "Quote" q ON q.id = qi."quoteId"
        WHERE (qi."orderByUnit" = true OR qi."unitPrice" = 0)
          AND (
            q."deliveryDate" IN (${todayDate}, ${yesterdayDate})
            OR q."createdAt" >= ${start7d}
          )
      ),
      no_quote_week AS (
        SELECT COUNT(*)::int AS "activeCustomersNoQuoteWeek"
        FROM "Customer" c
        WHERE c.active = true
          AND NOT EXISTS (
            SELECT 1
            FROM "Quote" q
            WHERE q."customerId" = c.id
              AND q."createdAt" >= ${startWeek}
          )
      ),
      missing_desperdicio AS (
        SELECT COUNT(*)::int AS "branchesMissingDesperdicioToday"
        FROM "Customer" c
        INNER JOIN "CustomerModuleAccess" m
          ON m."customerId" = c.id
          AND m.module = 'DESPERDICIOS'
          AND m.enabled = true
        WHERE c.active = true
          AND NOT EXISTS (
            SELECT 1
            FROM "DesperdicioEntry" e
            WHERE e."customerId" = c.id
              AND e."entryDate" = ${todayDate}
          )
      ),
      recent AS (
        SELECT COALESCE(
          json_agg(row_to_json(r) ORDER BY r."createdAt" DESC),
          '[]'::json
        ) AS recent
        FROM (
          SELECT
            q.id,
            q.number,
            q.total::float AS total,
            q."createdAt",
            c.code AS "customerCode",
            c.name AS "customerName"
          FROM "Quote" q
          INNER JOIN "Customer" c ON c.id = q."customerId"
          ORDER BY q."createdAt" DESC
          LIMIT 8
        ) r
      )
      SELECT
        k."quotesToday",
        k."quotesTodayTotal",
        k."quotesYesterday",
        k."customersQuotedToday",
        k."customersQuotedWeek",
        k."submittedQuotesToday",
        d."deliveriesToday",
        p."pendingWeighLines",
        pl."pendingWeighLive",
        nq."activeCustomersNoQuoteWeek",
        md."branchesMissingDesperdicioToday",
        r.recent
      FROM kpi k
      CROSS JOIN deliveries d
      CROSS JOIN pending p
      CROSS JOIN pending_live pl
      CROSS JOIN no_quote_week nq
      CROSS JOIN missing_desperdicio md
      CROSS JOIN recent r
    `;

    const row = rows[0];
    if (!row) return emptyDashboard();

    return {
      quotesToday: Number(row.quotesToday),
      quotesTodayTotal: Number(row.quotesTodayTotal),
      quotesYesterday: Number(row.quotesYesterday),
      customersQuotedToday: Number(row.customersQuotedToday),
      customersQuotedWeek: Number(row.customersQuotedWeek),
      pendingWeighLines: Number(row.pendingWeighLines),
      deliveriesToday: Number(row.deliveriesToday),
      pendingWeighLive: Number(row.pendingWeighLive),
      activeCustomersNoQuoteWeek: Number(row.activeCustomersNoQuoteWeek),
      submittedQuotesToday: Number(row.submittedQuotesToday),
      branchesMissingDesperdicioToday: Number(row.branchesMissingDesperdicioToday),
      recent: parseRecentJson(row.recent),
    };
  },
  ["admin-dashboard-v3-kpi-candidates"],
  { tags: [CACHE_TAGS.adminDashboard], revalidate: 86400 },
);

export function getAdminDashboardData(): Promise<AdminDashboardData> {
  return getCachedAdminDashboard(argentinaDayKey());
}
