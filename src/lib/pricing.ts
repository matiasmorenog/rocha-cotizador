import { Decimal } from "@prisma/client/runtime/library";

/**
 * Effective unit price for a customer.
 * `priceListId` null or isBase list → Precio base (`Product.basePrice`).
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

/** Excel col 5 / singleton Precio base PriceList. */
export const BASE_PRICE_LIST_EXCEL_KEY = "5";
export const BASE_PRICE_LIST_NAME = "Precio base";

/**
 * Default discount PriceList names keyed by Excel lista number (cols 6–9 only).
 * Col 5 = Precio base (`Product.basePrice` + isBase PriceList).
 * Col 4 ("Minorista" in Excel) is NOT a seeded PriceList — customers with lista 4 → base.
 */
export const EXCEL_PRICE_LIST_DEFAULTS: Record<string, { name: string; column: number }> = {
  "6": { name: "Lista 20% dto", column: 6 },
  "7": { name: "Lista 15% dto", column: 7 },
  "8": { name: "Lista 10% dto", column: 8 },
  "9": { name: "Lista 5% dto", column: 9 },
};

/**
 * Display order for known Excel discount keys: highest discount first.
 * excelKey 6→20%, 7→15%, 8→10%, 9→5%. isBase lists sort before these.
 */
const EXCEL_KEY_DISPLAY_ORDER: Record<string, number> = {
  "6": 0,
  "7": 1,
  "8": 2,
  "9": 3,
};

export type PriceListSortable = {
  name: string;
  excelKey?: string | null;
  isBase?: boolean;
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
  if (a.isBase && !b.isBase) return -1;
  if (!a.isBase && b.isBase) return 1;

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
 * "4" / "5" / empty / unknown → base list key `"5"`.
 * Only 6–9 map to discount PriceLists. Col 4 in the sheet is not seeded as a list.
 */
export function excelListaToPriceListKey(
  lista: string | number | null | undefined,
): string {
  if (lista === null || lista === undefined) return BASE_PRICE_LIST_EXCEL_KEY;
  const key = String(lista).trim();
  if (!key || key === "4" || key === "5") return BASE_PRICE_LIST_EXCEL_KEY;
  if (key in EXCEL_PRICE_LIST_DEFAULTS) return key;
  return BASE_PRICE_LIST_EXCEL_KEY;
}

/** Labels that mean Precio base on customer Excel import. */
export function isBasePriceListLabel(raw: string): boolean {
  const n = raw.trim().toLowerCase();
  return (
    !n ||
    n === "precio base" ||
    n === "minorista (base)" ||
    n === "mayorista (base)" ||
    n === "mayorista" ||
    n === "-"
  );
}
