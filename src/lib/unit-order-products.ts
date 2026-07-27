/**
 * Product codes from Excel LPM (yellow fill on col A) that allow order by
 * unit count OR kg. Price for unit orders is confirmed after weighing.
 * All other products are sold by fixed-price quantity (cantidad), not kg.
 */
export const UNIT_ORDER_PRODUCT_CODES = [
  "0001",
  "0002",
  "0003",
  "0006",
  "0007",
  "0009",
  "0010",
  "0011",
  "0018",
  "0020",
  "0021",
  "0022",
  "0023",
  "0024",
  "0038",
  "0039",
  "0040",
  "2043",
  "0043",
  "0044",
  "0045",
  "0046",
  "0047",
  "0048",
  "0049",
  "0050",
  "0051",
  "0052",
  "20001",
  "20002",
  "20003",
  "20004",
  "20005",
  "20006",
  "20007",
  "20008",
  "20009",
] as const;

export const UNIT_ORDER_PRODUCT_CODE_SET = new Set<string>(
  UNIT_ORDER_PRODUCT_CODES,
);

export function productAllowsUnitOrderByCode(code: string): boolean {
  return UNIT_ORDER_PRODUCT_CODE_SET.has(code);
}

/** Spanish copy for unit-order lines (quote UI + remito). */
export const UNIT_ORDER_PRICE_WARNING =
  "Precio a confirmar tras pesar el producto cocido";
