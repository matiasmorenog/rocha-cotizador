import { unstable_cache } from "next/cache";
import { parseArgentinaDateTime, toArgentinaDatetimeLocal } from "@/lib/argentina-time";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

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
  pendingWeighLines: number;
  recent: AdminDashboardRecentQuote[];
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

/**
 * Dashboard counts + recent quotes.
 * Sequential queries inside $transaction — one Neon connection (connection_limit=1).
 * TTL 1h (3600, same as catalog); freshness via `invalidateAfterQuoteCreate` /
 * wipe → `invalidateAfterDbScript` (all tags via POST /api/revalidate).
 */
const getCachedAdminDashboard = unstable_cache(
  async (day: string): Promise<AdminDashboardData> => {
    const startToday = argentinaDayStart(day);
    const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
    const startWeek = argentinaWeekMondayStart(day);

    return db.$transaction(async (tx) => {
      const quotesToday = await tx.quote.count({
        where: { createdAt: { gte: startToday } },
      });
      const quotesTodaySum = await tx.quote.aggregate({
        where: { createdAt: { gte: startToday } },
        _sum: { total: true },
      });
      const quotesYesterday = await tx.quote.count({
        where: {
          createdAt: { gte: startYesterday, lt: startToday },
        },
      });
      const customersQuotedTodayGroups = await tx.quote.groupBy({
        by: ["customerId"],
        where: { createdAt: { gte: startToday } },
      });
      const customersQuotedWeekGroups = await tx.quote.groupBy({
        by: ["customerId"],
        where: { createdAt: { gte: startWeek } },
      });
      // Same rule as remito: unit-order lines or $0 price still need weigh/confirm.
      const pendingWeighLines = await tx.quoteItem.count({
        where: {
          OR: [{ orderByUnit: true }, { unitPrice: 0 }],
        },
      });
      const recentRows = await tx.quote.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { code: true, name: true } } },
      });

      return {
        quotesToday,
        quotesTodayTotal: Number(quotesTodaySum._sum.total ?? 0),
        quotesYesterday,
        customersQuotedToday: customersQuotedTodayGroups.length,
        customersQuotedWeek: customersQuotedWeekGroups.length,
        pendingWeighLines,
        recent: recentRows.map((q) => ({
          id: q.id,
          number: q.number,
          total: Number(q.total),
          createdAt: q.createdAt.toISOString(),
          customer: q.customer,
        })),
      };
    });
  },
  ["admin-dashboard"],
  { tags: [CACHE_TAGS.adminDashboard], revalidate: 3600 },
);

export function getAdminDashboardData(): Promise<AdminDashboardData> {
  return getCachedAdminDashboard(argentinaDayKey());
}
