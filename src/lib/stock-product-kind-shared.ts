/**
 * Product stock classification — client/server safe (no DB).
 * Replaces rubro-based split when Product.stockKind is set.
 */

import { isConsumableRubro } from "@/lib/stock-rubros-shared";

/** Customer module / admin stock tab keys. */
export type StockModuleKey = "MERMAS" | "CONSUMABLES" | "ACTIVOS";

export type ProductStockKindValue = "MERMA" | "CONSUMABLE" | "LOCAL_ASSET";

export function stockKindForModule(
  module: StockModuleKey,
): ProductStockKindValue {
  switch (module) {
    case "MERMAS":
      return "MERMA";
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
  return stockKind == null || stockKind === "MERMA";
}

/**
 * Whether a product belongs in a stock module recount.
 * Uses stockKind when set; otherwise legacy rubro split (not for ACTIVOS).
 */
export function productMatchesStockModule(
  rubro: string | null | undefined,
  module: StockModuleKey,
  stockKind?: ProductStockKindValue | null,
): boolean {
  if (stockKind) {
    return stockKind === stockKindForModule(module);
  }
  if (module === "ACTIVOS") {
    return false;
  }
  return module === "CONSUMABLES"
    ? isConsumableRubro(rubro)
    : !isConsumableRubro(rubro);
}
