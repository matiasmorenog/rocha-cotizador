/**
 * Display units for stock catalog (mermas / consumibles).
 * Bakery + wholesale LatAm common set — extend here when needed.
 */
export const STOCK_UNITS = [
  "kg",
  "g",
  "unid.",
  "caja",
  "pack",
  "bolsa",
  "lata",
  "botella",
  "litro",
  "ml",
  "docena",
  "bandeja",
  "rollo",
  "paquete",
] as const;

export type StockUnit = (typeof STOCK_UNITS)[number];

export const DEFAULT_STOCK_UNIT: StockUnit = "unid.";

export function isStockUnit(value: string): value is StockUnit {
  return (STOCK_UNITS as readonly string[]).includes(value);
}

/** Prefer known unit; otherwise default (legacy free-text). */
export function coerceStockUnit(value: string | null | undefined): StockUnit {
  if (value && isStockUnit(value)) return value;
  return DEFAULT_STOCK_UNIT;
}
