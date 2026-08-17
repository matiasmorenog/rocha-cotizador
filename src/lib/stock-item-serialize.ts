/** Shared StockItem ↔ Product projection for APIs and admin/customer UI. */

export const stockItemListSelect = {
  id: true,
  productId: true,
  unit: true,
  active: true,
  sortOrder: true,
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      rubro: true,
      active: true,
    },
  },
} as const;

export const stockItemReportSelect = {
  unit: true,
  product: { select: { code: true, name: true, rubro: true } },
} as const;

type StockItemListRow = {
  id: string;
  productId: string;
  unit: string;
  active: boolean;
  sortOrder: number;
  product: {
    id: string;
    code: string;
    name: string;
    rubro: string | null;
    active: boolean;
  };
};

type StockItemReportRow = {
  unit: string;
  product: { code: string; name: string; rubro: string | null };
};

export function serializeStockItem(item: StockItemListRow): {
  id: string;
  productId: string;
  code: string;
  name: string;
  /** Tipo = Product.rubro */
  rubro: string | null;
  unit: string;
  active: boolean;
  sortOrder: number;
  product: {
    id: string;
    code: string;
    name: string;
    rubro: string | null;
    active: boolean;
  };
} {
  return {
    id: item.id,
    productId: item.productId,
    code: item.product.code,
    name: item.product.name,
    rubro: item.product.rubro,
    unit: item.unit,
    active: item.active,
    sortOrder: item.sortOrder,
    product: {
      id: item.product.id,
      code: item.product.code,
      name: item.product.name,
      rubro: item.product.rubro,
      active: item.product.active,
    },
  };
}

export function serializeStockItemReport(item: StockItemReportRow) {
  return {
    code: item.product.code,
    name: item.product.name,
    rubro: item.product.rubro,
    unit: item.unit,
  };
}
