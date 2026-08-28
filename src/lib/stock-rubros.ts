/**
 * Server-side stock product filters (DB/cache).
 */

import type { Prisma } from "@prisma/client";
import { getActiveProductsBase } from "@/lib/products-cache";
import {
  stockKindForModule,
  type StockModuleKey,
} from "@/lib/stock-product-kind-shared";
import {
  CONSUMABLE_RUBROS,
  uniqRubrosFromProducts,
} from "@/lib/stock-rubros-shared";

export {
  CONSUMABLE_RUBROS,
  isConsumableRubro,
  normalizeRubro,
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

const consumableRubroOr = CONSUMABLE_RUBROS.map((rubro) => ({
  rubro: { equals: rubro, mode: "insensitive" as const },
}));

const notConsumableRubroAnd = {
  OR: [
    { rubro: null },
    {
      NOT: {
        OR: consumableRubroOr,
      },
    },
  ],
};

export function productWhereForModule(
  module: StockModuleKey,
): Prisma.ProductWhereInput {
  const kind = stockKindForModule(module);

  if (module === "ACTIVOS") {
    return {
      available: true,
      stockKind: kind,
    };
  }

  if (module === "CONSUMABLES") {
    return {
      available: true,
      OR: [
        { stockKind: kind },
        {
          stockKind: null,
          OR: consumableRubroOr,
        },
      ],
    };
  }

  return {
    available: true,
    OR: [
      { stockKind: kind },
      {
        stockKind: null,
        AND: [notConsumableRubroAnd],
      },
    ],
  };
}
