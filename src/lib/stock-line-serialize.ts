/** Product projection for stock recount lines and admin reports. */

export const stockProductReportSelect = {
  code: true,
  name: true,
  rubro: true,
  allowsUnitOrder: true,
} as const;

export const stockLineSelect = {
  productId: true,
  unit: true,
  qty: true,
  product: { select: stockProductReportSelect },
} as const;

type ProductReportRow = {
  code: string;
  name: string;
  rubro: string | null;
  allowsUnitOrder: boolean;
};

export function serializeStockProductReport(product: ProductReportRow) {
  return {
    code: product.code,
    name: product.name,
    rubro: product.rubro,
    allowsUnitOrder: product.allowsUnitOrder,
  };
}

type StockLineRow = {
  productId: string;
  unit: string;
  qty: { toNumber?: () => number } | number | string;
  product: ProductReportRow;
};

export function serializeStockLine(line: StockLineRow) {
  const qty =
    typeof line.qty === "number"
      ? line.qty
      : typeof line.qty === "string"
        ? Number(line.qty)
        : line.qty.toNumber?.() ?? Number(line.qty);
  return {
    productId: line.productId,
    qty,
    unit: line.unit,
    product: serializeStockProductReport(line.product),
  };
}
