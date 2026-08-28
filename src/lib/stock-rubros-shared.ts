/**
 * Legacy rubro helpers — client/server safe (no DB/cache).
 * Stock module membership prefers Product.stockKind; rubro is fallback only.
 */

/** Rubros that matched consumibles before stockKind existed. */
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

export {
  productMatchesStockModule,
  stockKindForModule,
  type ProductStockKindValue,
  type StockModuleKey,
} from "@/lib/stock-product-kind-shared";

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
