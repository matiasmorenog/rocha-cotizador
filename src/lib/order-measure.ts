/**
 * Labels for quote/remito line measure.
 *
 * - `allowsUnitOrder` true: customer may choose kg or units (units → price TBD).
 * - `allowsUnitOrder` false: fixed-price quantity (unidades), not kg.
 */
export function quoteLineMeasureLabel(
  orderByUnit: boolean,
  allowsUnitOrder: boolean,
): string {
  if (orderByUnit) return "unid.";
  if (allowsUnitOrder) return "kg";
  return "unid.";
}

export function quoteLineQtyAriaLabel(
  orderByUnit: boolean,
  allowsUnitOrder: boolean,
): string {
  if (orderByUnit || !allowsUnitOrder) return "Cantidad en unidades";
  return "Cantidad en kg";
}

export function productOrderModeBadge(allowsUnitOrder: boolean): string {
  return allowsUnitOrder ? "Unidad/Kg" : "Cantidad";
}

export function productOrderModeDescription(allowsUnitOrder: boolean): string {
  return allowsUnitOrder
    ? "Pedido por unidades o kg"
    : "Pedido por cantidad (precio fijo)";
}
