import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { ProductBase } from "@/lib/product-base";

export type { ProductBase } from "@/lib/product-base";

/**
 * Version for client invalidation: any Product row change (incl. active toggle)
 * bumps `updatedAt`, so MAX covers create/update/deactivate/reactivate.
 */
export async function getProductsCatalogVersion(): Promise<string> {
  const result = await db.product.aggregate({
    _max: { updatedAt: true },
  });
  return result._max.updatedAt?.toISOString() ?? "0";
}

/**
 * Active products (basePrice only). Shared across customers.
 * Invalidate via tag `products` after admin product mutate / import.
 */
export const getActiveProductsBase = unstable_cache(
  async (): Promise<ProductBase[]> => {
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
  },
  ["active-products-base"],
  { tags: [CACHE_TAGS.products], revalidate: 3600 },
);

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
