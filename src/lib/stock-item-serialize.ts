/** Shared StockItem ↔ Product projection for APIs and admin/customer UI. */

import type { StockItemKind } from "@prisma/client";

export const stockItemListSelect = {
  id: true,
  productId: true,
  kind: true,
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
  kind: true,
  unit: true,
  product: { select: { code: true, name: true } },
} as const;

type StockItemListRow = {
  id: string;
  productId: string;
  kind: StockItemKind;
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
  kind: StockItemKind;
  unit: string;
  product: { code: string; name: string };
};

export function serializeStockItem(item: StockItemListRow): {
  id: string;
  productId: string;
  code: string;
  name: string;
  rubro: string | null;
  kind: StockItemKind;
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
    kind: item.kind,
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
    kind: item.kind,
    unit: item.unit,
  };
}
