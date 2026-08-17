/**
 * Stock “Tipo” = Product.rubro.
 * Prefer deriving options with uniqRubrosFromProducts when a full product list
 * is already loaded — no separate DISTINCT query in that case.
 * Fallback listDistinctProductRubros uses the cached active-products catalog.
 */

import type { Prisma } from "@prisma/client";
import { getActiveProductsBase } from "@/lib/products-cache";

/** Rubros that appear on /consumibles (rest of stock → /mermas). */
export const CONSUMABLE_RUBROS = ["INSUMOS", "REGALO"] as const;

export function normalizeRubro(rubro: string | null | undefined): string | null {
  const t = (rubro ?? "").trim();
  return t.length > 0 ? t : null;
}

export function isConsumableRubro(rubro: string | null | undefined): boolean {
  const n = normalizeRubro(rubro);
  if (!n) return false;
  return (CONSUMABLE_RUBROS as readonly string[]).some(
    (r) => r.toLowerCase() === n.toLowerCase(),
  );
}

/** Unique sorted non-empty rubro values from an in-memory product list. */
export function uniqRubrosFromProducts(
  products: Array<{ rubro?: string | null }>,
): string[] {
  const byLower = new Map<string, string>();
  for (const p of products) {
    const n = normalizeRubro(p.rubro);
    if (!n) continue;
    const key = n.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, n);
  }
  return [...byLower.values()].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
}

/**
 * Fallback when the page does not already have a full product list.
 * Derives from cached active products — no Prisma DISTINCT.
 */
export async function listDistinctProductRubros(): Promise<string[]> {
  const products = await getActiveProductsBase();
  return uniqRubrosFromProducts(products);
}

export function stockItemWhereForModule(
  module: "MERMAS" | "CONSUMABLES",
): Prisma.StockItemWhereInput {
  if (module === "CONSUMABLES") {
    return {
      active: true,
      product: {
        active: true,
        OR: CONSUMABLE_RUBROS.map((rubro) => ({
          rubro: { equals: rubro, mode: "insensitive" as const },
        })),
      },
    };
  }
  return {
    active: true,
    product: {
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
    },
  };
}
