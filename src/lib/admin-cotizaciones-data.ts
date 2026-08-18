import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { formatDateOnlyYmd } from "@/lib/delivery-date";

export type AdminCotizacionRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  deliveryDate: string | null;
  customer: { code: string; name: string };
};

async function fetchAdminCotizacionesUncached(
  from: Date,
  to: Date,
): Promise<AdminCotizacionRow[]> {
  const quotes = await db.quote.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      createdAt: true,
      deliveryDate: true,
      customerId: true,
    },
  });

  if (quotes.length === 0) return [];

  const customerIds = [...new Set(quotes.map((q) => q.customerId))];
  const customers = await db.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, code: true, name: true },
  });
  const customerById = new Map(customers.map((c) => [c.id, c] as const));

  return quotes.map((q) => {
    const customer = customerById.get(q.customerId);
    return {
      id: q.id,
      number: q.number,
      status: q.status,
      total: Number(q.total),
      createdAt: q.createdAt.toISOString(),
      deliveryDate: q.deliveryDate ? formatDateOnlyYmd(q.deliveryDate) : null,
      customer: customer ?? { code: "?", name: "—" },
    };
  });
}

/**
 * Quotes list for admin /cotizaciones (and filter API).
 * Flat customer lookup; keyed by range. Default rolling `to` buckets to minute
 * so Data Cache hits without stale-every-second keys. TTL 24h; bust via
 * `invalidateAfterQuoteCreate` / item price updates (admin-dashboard tag).
 */
const getCachedAdminCotizaciones = unstable_cache(
  async (fromIso: string, toIso: string) => {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    return fetchAdminCotizacionesUncached(from, to);
  },
  ["admin-cotizaciones"],
  { tags: [CACHE_TAGS.adminDashboard], revalidate: 86400 },
);

/** Stable cache key for default rolling `to` (minute bucket). */
export function quotesRangeCacheToIso(to: Date, explicitToParam?: string | null): string {
  if (explicitToParam?.trim()) return to.toISOString();
  const bucketMs = Math.floor(to.getTime() / 60_000) * 60_000;
  return new Date(bucketMs).toISOString();
}

export function getAdminCotizacionesQuotes(
  from: Date,
  to: Date,
  explicitToParam?: string | null,
): Promise<AdminCotizacionRow[]> {
  const queryTo = explicitToParam?.trim()
    ? to
    : new Date(quotesRangeCacheToIso(to, explicitToParam));
  return getCachedAdminCotizaciones(
    from.toISOString(),
    queryTo.toISOString(),
  );
}
