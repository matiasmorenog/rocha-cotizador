import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tag-names";
import { invalidateProductsCache } from "@/lib/cache-tags";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import { productWhereForModule } from "@/lib/stock-rubros";
import { filterFoldedSearch } from "@/lib/search-fold";

export type StockModuleProduct = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  basePrice: number;
  allowsUnitOrder: boolean;
  stockKind: "DESPERDICIO" | "CONSUMABLE" | "LOCAL_ASSET" | null;
};

async function fetchStockModuleProductsUncached(
  module: StockModuleKey,
): Promise<StockModuleProduct[]> {
  const rows = await db.product.findMany({
    where: productWhereForModule(module),
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      rubro: true,
      basePrice: true,
      allowsUnitOrder: true,
      stockKind: true,
    },
  });

  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    rubro: p.rubro,
    basePrice: Number(p.basePrice),
    allowsUnitOrder: p.allowsUnitOrder,
    stockKind: p.stockKind,
  }));
}

function getStockModuleProductsCached(module: StockModuleKey) {
  return unstable_cache(
    async () => fetchStockModuleProductsUncached(module),
    ["stock-module-products", module],
    { tags: [CACHE_TAGS.products], revalidate: 86400 },
  )();
}

/** Module-scoped products for stock recount pickers (all kinds, not quote catalog). */
export async function getStockModuleProducts(
  module: StockModuleKey,
): Promise<StockModuleProduct[]> {
  const cached = await getStockModuleProductsCached(module);
  if (cached.length > 0) return cached;

  const fresh = await fetchStockModuleProductsUncached(module);
  if (fresh.length > 0) {
    invalidateProductsCache();
  }
  return fresh;
}

export function searchStockModuleProducts(
  products: readonly StockModuleProduct[],
  q: string,
  take: number,
): StockModuleProduct[] {
  return filterFoldedSearch(products, q, {
    primary: [(p) => p.code],
    secondary: [(p) => p.name, (p) => p.rubro],
    take,
    emptyReturnsAll: true,
  });
}
