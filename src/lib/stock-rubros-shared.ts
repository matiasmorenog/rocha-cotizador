/**
 * Rubro helpers — client/server safe (no DB/cache).
 * Stock module membership uses Product.stockKind.
 */

import {
  DEFAULT_PRODUCT_STOCK_KIND,
  type ProductStockKindValue,
} from "@/lib/stock-product-kind-shared";

/** Rubros que van al módulo Consumibles (stockKind CONSUMABLE). */
export const CONSUMABLE_RUBROS = ["GASEOSAS", "INSUMOS", "REGALO"] as const;

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

export {
  productMatchesStockModule,
  stockKindForModule,
  type ProductStockKindValue,
  type StockModuleKey,
} from "@/lib/stock-product-kind-shared";

/** Default stockKind for new/imported products from rubro (GASEOSAS → consumible). */
export function inferStockKindFromRubro(
  rubro: string | null | undefined,
): ProductStockKindValue {
  return isConsumableRubro(rubro) ? "CONSUMABLE" : DEFAULT_PRODUCT_STOCK_KIND;
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
