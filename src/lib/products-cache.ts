import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS, invalidateProductsCache } from "@/lib/cache-tags";
import type { ProductBase } from "@/lib/product-base";

export type { ProductBase } from "@/lib/product-base";

/**
 * Version for client invalidation: any Product row change (incl. active toggle)
 * bumps `updatedAt`, so MAX covers create/update/deactivate/reactivate.
 */
export async function getProductsCatalogVersion(): Promise<string> {
  const [products, lists, items] = await Promise.all([
    db.product.aggregate({ _max: { updatedAt: true } }),
    db.priceList.aggregate({ _max: { updatedAt: true } }),
    db.priceListItem.aggregate({ _max: { updatedAt: true } }),
  ]);
  const stamps = [
    products._max.updatedAt,
    lists._max.updatedAt,
    items._max.updatedAt,
  ]
    .filter(Boolean)
    .map((d) => d!.toISOString());
  return stamps.sort().at(-1) ?? "0";
}

async function fetchActiveProductsBaseUncached(): Promise<ProductBase[]> {
  const rows = await db.product.findMany({
    where: { active: true },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      rubro: true,
      basePrice: true,
    },
  });
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    rubro: p.rubro,
    basePrice: Number(p.basePrice),
  }));
}

/**
 * Active products (basePrice only). Shared across customers.
 * Invalidate via tag `products` after admin product mutate / import.
 *
 * Empty Data Cache entries are treated as poison: bypass + expire tag so a
 * brief empty window (pre-seed / blip) cannot stick for the full TTL.
 */
const getActiveProductsBaseCached = unstable_cache(
  async (): Promise<ProductBase[]> => fetchActiveProductsBaseUncached(),
  ["active-products-base"],
  { tags: [CACHE_TAGS.products], revalidate: 3600 },
);

export async function getActiveProductsBase(): Promise<ProductBase[]> {
  const cached = await getActiveProductsBaseCached();
  if (cached.length > 0) return cached;

  const fresh = await fetchActiveProductsBaseUncached();
  if (fresh.length > 0) {
    invalidateProductsCache();
  }
  return fresh;
}

/** In-memory filter over cached catalog (no per-query DB hit). */
export async function searchActiveProductsBase(
  q: string,
  take = 30,
): Promise<ProductBase[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  const all = await getActiveProductsBase();
  const matched: ProductBase[] = [];
  for (const p of all) {
    if (
      p.code.toLowerCase().includes(needle) ||
      p.name.toLowerCase().includes(needle)
    ) {
      matched.push(p);
      if (matched.length >= take) break;
    }
  }
  return matched;
}
