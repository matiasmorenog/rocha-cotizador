/**
 * Server-side stock product filters (DB/cache).
 */

import type { Prisma } from "@prisma/client";
import { getActiveProductsBase } from "@/lib/products-cache";
import {
  stockKindForModule,
  type StockModuleKey,
} from "@/lib/stock-product-kind-shared";
import { uniqRubrosFromProducts } from "@/lib/stock-rubros-shared";

export {
  CONSUMABLE_RUBROS,
  isConsumableRubro,
  normalizeRubro,
  inferStockKindFromRubro,
  productMatchesStockModule,
  stockKindForModule,
  uniqRubrosFromProducts,
  type StockModuleKey,
} from "@/lib/stock-rubros-shared";

export { isProductQuotable } from "@/lib/stock-product-kind-shared";

export async function listDistinctProductRubros(): Promise<string[]> {
  const products = await getActiveProductsBase();
  return uniqRubrosFromProducts(products);
}

export function productWhereForModule(
  module: StockModuleKey,
): Prisma.ProductWhereInput {
  const kind = stockKindForModule(module);
  if (kind === "DESPERDICIO") {
    return {
      available: true,
      OR: [{ stockKind: "DESPERDICIO" }, { stockKind: null }],
    };
  }
  return {
    available: true,
    stockKind: kind,
  };
}
