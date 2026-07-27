import { unstable_cache } from "next/cache";
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
  products: number;
  quotesToday: number;
  recent: AdminDashboardRecentQuote[];
};

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Dashboard counts + recent quotes.
 * Sequential queries inside $transaction — one Neon connection (connection_limit=1).
 * TTL 1h (3600, same as catalog); freshness via `invalidateAfterQuoteCreate` /
 * wipe → `invalidateAfterDbScript` (all tags via POST /api/revalidate).
 */
const getCachedAdminDashboard = unstable_cache(
  async (day: string): Promise<AdminDashboardData> => {
    const [y, m, d] = day.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    start.setHours(0, 0, 0, 0);

    return db.$transaction(async (tx) => {
      const customers = await tx.customer.count({ where: { active: true } });
      const products = await tx.product.count({ where: { active: true } });
      const quotesToday = await tx.quote.count({
        where: { createdAt: { gte: start } },
      });
      const recentRows = await tx.quote.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { code: true, name: true } } },
      });

      return {
        customers,
        products,
        quotesToday,
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
  return getCachedAdminDashboard(dayKey());
}
