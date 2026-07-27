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

/**
 * Slow-changing counts only. Quote lists must NEVER live in Data Cache —
 * external wipes / deletes would otherwise show stale rows for up to TTL
 * (stale-while-revalidate) even on a fresh post-login hard navigation.
 */
const getCachedDashboardCounts = unstable_cache(
  async (): Promise<{ customers: number; products: number }> => {
    return db.$transaction(async (tx) => {
      const customers = await tx.customer.count({ where: { active: true } });
      const products = await tx.product.count({ where: { active: true } });
      return { customers, products };
    });
  },
  ["admin-dashboard-counts"],
  { tags: [CACHE_TAGS.adminDashboard], revalidate: 120 },
);

async function getFreshDashboardQuotes(): Promise<{
  quotesToday: number;
  recent: AdminDashboardRecentQuote[];
}> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return db.$transaction(async (tx) => {
    const quotesToday = await tx.quote.count({
      where: { createdAt: { gte: start } },
    });
    const recentRows = await tx.quote.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { code: true, name: true } } },
    });

    return {
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
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [counts, quotes] = await Promise.all([
    getCachedDashboardCounts(),
    getFreshDashboardQuotes(),
  ]);
  return { ...counts, ...quotes };
}
