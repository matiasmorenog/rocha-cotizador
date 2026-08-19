/** Product projection for stock recount lines and admin reports. */

export const stockProductReportSelect = {
  code: true,
  name: true,
  rubro: true,
  allowsUnitOrder: true,
} as const;

/** Flat line select — join products in memory to avoid nested Prisma joins. */
export const stockLineFlatSelect = {
  productId: true,
  unit: true,
  qty: true,
} as const;

/** Nested select for single-entry loads that still use inline product join. */
export const stockLineSelect = {
  ...stockLineFlatSelect,
  product: { select: stockProductReportSelect },
} as const;

export type ProductReportRow = {
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

const missingProductReport: ProductReportRow = {
  code: "?",
  name: "—",
  rubro: null,
  allowsUnitOrder: false,
};

type StockLineFlatRow = {
  productId: string;
  unit: string;
  qty: { toNumber?: () => number } | number | string;
};

type StockLineRow = StockLineFlatRow & {
  product: ProductReportRow;
};

export function serializeStockLinesWithProducts(
  lines: StockLineFlatRow[],
  productById: Map<string, ProductReportRow>,
) {
  return lines.map((line) =>
    serializeStockLine({
      ...line,
      product: productById.get(line.productId) ?? missingProductReport,
    }),
  );
}

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
