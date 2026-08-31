/**
 * Product stock classification — client/server safe (no DB).
 */

/** Customer module / admin stock tab keys. */
export type StockModuleKey = "DESPERDICIOS" | "CONSUMABLES" | "ACTIVOS";

export type ProductStockKindValue = "DESPERDICIO" | "CONSUMABLE" | "LOCAL_ASSET";

export const DEFAULT_PRODUCT_STOCK_KIND: ProductStockKindValue = "DESPERDICIO";

export function stockKindForModule(
  module: StockModuleKey,
): ProductStockKindValue {
  switch (module) {
    case "DESPERDICIOS":
      return "DESPERDICIO";
    case "CONSUMABLES":
      return "CONSUMABLE";
    case "ACTIVOS":
      return "LOCAL_ASSET";
  }
}

/** Products that may appear in the quote catalog (available + kind rules). */
export function isProductQuotable(
  stockKind: ProductStockKindValue | null | undefined,
): boolean {
  return stockKind == null || stockKind === "DESPERDICIO";
}

/** Only elaborados (DESPERDICIO) may enable kg vs unit choice in quotes. */
export function productSupportsUnitOrKgOrder(
  stockKind: ProductStockKindValue | null | undefined,
): boolean {
  return (stockKind ?? DEFAULT_PRODUCT_STOCK_KIND) === "DESPERDICIO";
}

export function normalizeAllowsUnitOrder(
  stockKind: ProductStockKindValue | null | undefined,
  allowsUnitOrder: boolean,
): boolean {
  return productSupportsUnitOrKgOrder(stockKind) && allowsUnitOrder;
}

/**
 * Whether a product belongs in a stock module recount.
 */
export function productMatchesStockModule(
  rubro: string | null | undefined,
  module: StockModuleKey,
  stockKind?: ProductStockKindValue | null,
): boolean {
  void rubro;
  const kind = stockKind ?? DEFAULT_PRODUCT_STOCK_KIND;
  return kind === stockKindForModule(module);
}
