/**
 * Server-side stock rubro helpers (DB/cache).
 */

import type { Prisma } from "@prisma/client";
import { getActiveProductsBase } from "@/lib/products-cache";
import {
  CONSUMABLE_RUBROS,
  uniqRubrosFromProducts,
} from "@/lib/stock-rubros-shared";

export {
  CONSUMABLE_RUBROS,
  isConsumableRubro,
  normalizeRubro,
  productMatchesStockModule,
  uniqRubrosFromProducts,
} from "@/lib/stock-rubros-shared";

export async function listDistinctProductRubros(): Promise<string[]> {
  const products = await getActiveProductsBase();
  return uniqRubrosFromProducts(products);
}

export function productWhereForModule(
  module: "MERMAS" | "CONSUMABLES",
): Prisma.ProductWhereInput {
  if (module === "CONSUMABLES") {
    return {
      active: true,
      OR: CONSUMABLE_RUBROS.map((rubro) => ({
        rubro: { equals: rubro, mode: "insensitive" as const },
      })),
    };
  }
  return {
    active: true,
    AND: [
      {
        OR: [
          { rubro: null },
          {
            NOT: {
              OR: CONSUMABLE_RUBROS.map((rubro) => ({
                rubro: { equals: rubro, mode: "insensitive" as const },
              })),
            },
          },
        ],
      },
    ],
  };
}
