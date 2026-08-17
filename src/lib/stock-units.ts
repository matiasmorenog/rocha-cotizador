/**
 * Stock recount units — same measure model as quotes/remitos per product.
 *
 * - allowsUnitOrder: kg or unid.
 * - otherwise: unid. only
 */
export const PRODUCT_MEASURE_UNITS = ["kg", "unid."] as const;

export type ProductMeasureUnit = (typeof PRODUCT_MEASURE_UNITS)[number];

export const DEFAULT_STOCK_UNIT: ProductMeasureUnit = "unid.";

export function stockUnitsForProduct(
  allowsUnitOrder: boolean,
): ProductMeasureUnit[] {
  return allowsUnitOrder ? ["kg", "unid."] : ["unid."];
}

export function defaultStockUnitForProduct(
  allowsUnitOrder: boolean,
): ProductMeasureUnit {
  return allowsUnitOrder ? "kg" : "unid.";
}

export function isProductMeasureUnit(
  value: string,
): value is ProductMeasureUnit {
  return (PRODUCT_MEASURE_UNITS as readonly string[]).includes(value);
}

/** Normalize saved/API unit to what the product allows. */
export function coerceStockUnitForProduct(
  value: string | null | undefined,
  allowsUnitOrder: boolean,
): ProductMeasureUnit {
  if (value === "kg" && allowsUnitOrder) return "kg";
  if (
    value === "unid." ||
    value === "unidades" ||
    value === "unit" ||
    !allowsUnitOrder
  ) {
    return "unid.";
  }
  return defaultStockUnitForProduct(allowsUnitOrder);
}

export function isValidStockUnitForProduct(
  unit: string,
  allowsUnitOrder: boolean,
): boolean {
  return stockUnitsForProduct(allowsUnitOrder).includes(unit as ProductMeasureUnit);
}
