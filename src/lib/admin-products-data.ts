import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tag-names";
import { sortPriceListsForDisplay } from "@/lib/pricing";
import { uniqRubrosFromProducts } from "@/lib/stock-rubros";

export type AdminProductTableRow = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  basePrice: number;
  available: boolean;
  stockKind: "DESPERDICIO" | "CONSUMABLE" | "LOCAL_ASSET" | null;
  allowsUnitOrder: boolean;
  /** priceListId → unitPrice */
  listPrices: Record<string, number>;
};

export type AdminProductPriceListOption = {
  id: string;
  name: string;
  active: boolean;
};

export type AdminProductosPageData = {
  products: AdminProductTableRow[];
  priceLists: AdminProductPriceListOption[];
  rubros: string[];
};

async function fetchAdminProductosPageDataUncached(): Promise<AdminProductosPageData> {
  const [products, priceListItems, priceListsRaw] = await Promise.all([
    db.product.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        rubro: true,
        basePrice: true,
        available: true,
        stockKind: true,
        allowsUnitOrder: true,
      },
    }),
    db.priceListItem.findMany({
      select: { productId: true, priceListId: true, unitPrice: true },
    }),
    db.priceList.findMany({
      select: { id: true, name: true, active: true, excelKey: true, isBase: true },
    }),
  ]);

  const listPricesByProduct = new Map<string, Record<string, number>>();
  for (const item of priceListItems) {
    let listPrices = listPricesByProduct.get(item.productId);
    if (!listPrices) {
      listPrices = {};
      listPricesByProduct.set(item.productId, listPrices);
    }
    listPrices[item.priceListId] = Number(item.unitPrice);
  }

  const tableRows = products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    rubro: p.rubro,
    basePrice: Number(p.basePrice),
    available: p.available,
    stockKind: p.stockKind,
    allowsUnitOrder: p.allowsUnitOrder,
    listPrices: listPricesByProduct.get(p.id) ?? {},
  }));

  const priceLists = sortPriceListsForDisplay(priceListsRaw)
    .filter((l) => !l.isBase)
    .map(({ id, name, active }) => ({ id, name, active }));

  return {
    products: tableRows,
    priceLists,
    rubros: uniqRubrosFromProducts(products),
  };
}

/**
 * Admin /productos table payload (all products + list prices).
 * Flat queries avoid Prisma nested join overhead (~483 products × list items).
 * TTL 24h; freshness via invalidateAfterProductMutation / price-list tags.
 */
const getCachedAdminProductosPageData = unstable_cache(
  fetchAdminProductosPageDataUncached,
  ["admin-productos-page"],
  { tags: [CACHE_TAGS.products, CACHE_TAGS.priceLists], revalidate: 86400 },
);

export function getAdminProductosPageData(): Promise<AdminProductosPageData> {
  return getCachedAdminProductosPageData();
}
