import { Decimal } from "@prisma/client/runtime/library";

/**
 * Effective unit price for a customer.
 * `priceListId` null → Minorista base (`Product.basePrice`).
 * Missing list item → fallback to `basePrice`.
 */
export function unitPriceForProduct(
  basePrice: Decimal | number | string,
  listUnitPrice: Decimal | number | string | null | undefined,
): Decimal {
  if (listUnitPrice !== null && listUnitPrice !== undefined) {
    return new Decimal(listUnitPrice).toDecimalPlaces(2);
  }
  return new Decimal(basePrice).toDecimalPlaces(2);
}

export function lineTotal(unitPrice: Decimal, qty: Decimal | number | string): Decimal {
  return unitPrice.mul(new Decimal(qty)).toDecimalPlaces(2);
}

/** Default PriceList names keyed by Excel lista number (cols 4, 6–9). */
export const EXCEL_PRICE_LIST_DEFAULTS: Record<string, { name: string; column: number }> = {
  "4": { name: "Minorista", column: 4 },
  "6": { name: "Lista 20% dto", column: 6 },
  "7": { name: "Lista 15% dto", column: 7 },
  "8": { name: "Lista 10% dto", column: 8 },
  "9": { name: "Lista 5% dto", column: 9 },
};

/**
 * Display order for known Excel keys: highest discount first, then Minorista list.
 * excelKey 6→20%, 7→15%, 8→10%, 9→5%, 4→Minorista.
 */
const EXCEL_KEY_DISPLAY_ORDER: Record<string, number> = {
  "6": 0,
  "7": 1,
  "8": 2,
  "9": 3,
  "4": 4,
};

export type PriceListSortable = {
  name: string;
  excelKey?: string | null;
};

function discountPercentFromName(name: string): number | null {
  const m = name.match(/(\d+)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Compare for product-table / export / admin list column order. */
export function comparePriceListsForDisplay(
  a: PriceListSortable,
  b: PriceListSortable,
): number {
  const aOrder =
    a.excelKey != null ? EXCEL_KEY_DISPLAY_ORDER[a.excelKey] : undefined;
  const bOrder =
    b.excelKey != null ? EXCEL_KEY_DISPLAY_ORDER[b.excelKey] : undefined;

  if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
  if (aOrder !== undefined) return -1;
  if (bOrder !== undefined) return 1;

  const aPct = discountPercentFromName(a.name);
  const bPct = discountPercentFromName(b.name);
  if (aPct != null && bPct != null && aPct !== bPct) return bPct - aPct;
  if (aPct != null && bPct == null) return -1;
  if (aPct == null && bPct != null) return 1;

  return a.name.localeCompare(b.name, "es");
}

/** Stable copy sorted for UI / Excel column order. */
export function sortPriceListsForDisplay<T extends PriceListSortable>(
  lists: T[],
): T[] {
  return [...lists].sort(comparePriceListsForDisplay);
}

/**
 * Excel lista → price list excelKey.
 * "5" / empty / unknown → null (Product.basePrice = Minorista sin descuento in UI).
 * Excel sheet header for col 5 may still say "Mayorista"; product owner names that base Minorista.
 */
export function excelListaToPriceListKey(
  lista: string | number | null | undefined,
): string | null {
  if (lista === null || lista === undefined) return null;
  const key = String(lista).trim();
  if (!key || key === "5") return null;
  if (key in EXCEL_PRICE_LIST_DEFAULTS) return key;
  return null;
}
