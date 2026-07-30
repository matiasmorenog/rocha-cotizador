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
  customers: number;
  customersInactive: number;
  products: number;
  productsInactive: number;
  quotesToday: number;
  quotesTodayTotal: number;
  quotesYesterday: number;
  recent: AdminDashboardRecentQuote[];
};

/** Calendar day key in America/Argentina/Buenos_Aires (`YYYY-M-D` / `YYYY-MM-DD`). */
function argentinaDayKey(d = new Date()): string {
  return toArgentinaDatetimeLocal(d).slice(0, 10);
}

function argentinaDayStart(day: string): Date {
  const start = parseArgentinaDateTime(`${day}T00:00`);
  if (!start) throw new Error(`Invalid Argentina day key: ${day}`);
  return start;
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

    return db.$transaction(async (tx) => {
      const customers = await tx.customer.count({ where: { active: true } });
      const customersInactive = await tx.customer.count({ where: { active: false } });
      const products = await tx.product.count({ where: { active: true } });
      const productsInactive = await tx.product.count({ where: { active: false } });
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
      const recentRows = await tx.quote.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { code: true, name: true } } },
      });

      return {
        customers,
        customersInactive,
        products,
        productsInactive,
        quotesToday,
        quotesTodayTotal: Number(quotesTodaySum._sum.total ?? 0),
        quotesYesterday,
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
