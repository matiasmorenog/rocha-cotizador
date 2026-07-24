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
