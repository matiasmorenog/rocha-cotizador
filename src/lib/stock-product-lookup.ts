import { db } from "@/lib/db";
import { getActiveProductsBase } from "@/lib/products-cache";
import {
  stockProductReportSelect,
  type ProductReportRow,
} from "@/lib/stock-line-serialize";

type CatalogProductRow = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  allowsUnitOrder: boolean;
};

function toReportRow(product: CatalogProductRow): ProductReportRow {
  return {
    code: product.code,
    name: product.name,
    rubro: product.rubro,
    allowsUnitOrder: product.allowsUnitOrder,
  };
}

/** Map product ids from the 24h catalog cache; DB only for inactive/missing ids. */
export async function resolveStockProductReportMap(
  productIds: string[],
  catalog?: ReadonlyArray<CatalogProductRow>,
): Promise<Map<string, ProductReportRow>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const wanted = new Set(productIds);
  const source = catalog ?? (await getActiveProductsBase());
  const map = new Map<string, ProductReportRow>();
  for (const product of source) {
    if (!wanted.has(product.id)) continue;
    map.set(product.id, toReportRow(product));
  }

  const missing = productIds.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const extra = await db.product.findMany({
    where: { id: { in: missing } },
    select: { id: true, ...stockProductReportSelect },
  });
  for (const product of extra) {
    const { id, ...row } = product;
    map.set(id, row);
  }
  return map;
}
