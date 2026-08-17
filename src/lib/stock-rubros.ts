/**
 * Stock module split by Product.rubro.
 * Mermas = panes/masas (waste). Consumibles = inventory (gaseosas, insumos, etc.).
 */

import type { Prisma } from "@prisma/client";
import { getActiveProductsBase } from "@/lib/products-cache";

/** Rubros that appear in consumibles recount (rest → mermas). */
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
