import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tag-names";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export type AdminPriceListTableRow = {
  id: string;
  name: string;
  excelKey: string | null;
  active: boolean;
  isBase: boolean;
  itemCount: number;
  customerCount: number;
};

async function fetchAdminPriceListsUncached(): Promise<AdminPriceListTableRow[]> {
  const [lists, itemCounts, customerCounts] = await Promise.all([
    db.priceList.findMany({
      select: {
        id: true,
        name: true,
        excelKey: true,
        active: true,
        isBase: true,
      },
    }),
    db.priceListItem.groupBy({
      by: ["priceListId"],
      _count: { _all: true },
    }),
    db.customer.groupBy({
      by: ["priceListId"],
      where: { priceListId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const itemsByList = new Map(
    itemCounts.map((r) => [r.priceListId, r._count._all] as const),
  );
  const customersByList = new Map(
    customerCounts
      .filter((r): r is typeof r & { priceListId: string } => r.priceListId != null)
      .map((r) => [r.priceListId, r._count._all] as const),
  );

  return sortPriceListsForDisplay(lists).map((l) => ({
    id: l.id,
    name: l.name,
    excelKey: l.excelKey,
    active: l.active,
    isBase: l.isBase,
    itemCount: itemsByList.get(l.id) ?? 0,
    customerCount: customersByList.get(l.id) ?? 0,
  }));
}

const getCachedAdminPriceLists = unstable_cache(
  fetchAdminPriceListsUncached,
  ["admin-price-lists-page"],
  { tags: [CACHE_TAGS.priceLists, CACHE_TAGS.customers], revalidate: 86400 },
);

export function getAdminPriceListsPageData(): Promise<AdminPriceListTableRow[]> {
  return getCachedAdminPriceLists();
}

export type AdminPriceListDetailItem = {
  productId: string;
  unitPrice: number;
  product: {
    code: string;
    name: string;
    rubro: string | null;
    basePrice: number;
    active: boolean;
  };
};

export type AdminPriceListDetail = {
  id: string;
  name: string;
  active: boolean;
  isBase: boolean;
  excelKey: string | null;
  customerCount: number;
  updatedAt: string;
  items: AdminPriceListDetailItem[];
};

async function fetchAdminPriceListDetailUncached(
  id: string,
): Promise<AdminPriceListDetail | null> {
  const [list, items, customerCount] = await Promise.all([
    db.priceList.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        active: true,
        isBase: true,
        excelKey: true,
        updatedAt: true,
      },
    }),
    db.priceListItem.findMany({
      where: { priceListId: id },
      select: { productId: true, unitPrice: true },
    }),
    db.customer.count({ where: { priceListId: id } }),
  ]);

  if (!list) return null;

  const productIds = items.map((i) => i.productId);
  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            code: true,
            name: true,
            rubro: true,
            basePrice: true,
            active: true,
          },
        })
      : [];
  const productById = new Map(products.map((p) => [p.id, p] as const));

  const detailItems = items
    .map((i) => {
      const product = productById.get(i.productId);
      if (!product) return null;
      return {
        productId: i.productId,
        unitPrice: Number(i.unitPrice),
        product: {
          code: product.code,
          name: product.name,
          rubro: product.rubro,
          basePrice: Number(product.basePrice),
          active: product.active,
        },
      };
    })
    .filter((row): row is AdminPriceListDetailItem => row != null)
    .sort((a, b) => a.product.code.localeCompare(b.product.code));

  return {
    id: list.id,
    name: list.name,
    active: list.active,
    isBase: list.isBase,
    excelKey: list.excelKey,
    customerCount,
    updatedAt: list.updatedAt.toISOString(),
    items: detailItems,
  };
}

const getCachedAdminPriceListDetail = unstable_cache(
  async (id: string) => fetchAdminPriceListDetailUncached(id),
  ["admin-price-list-detail"],
  {
    tags: [CACHE_TAGS.priceLists, CACHE_TAGS.products],
    revalidate: 86400,
  },
);

export function getAdminPriceListDetail(
  id: string,
): Promise<AdminPriceListDetail | null> {
  return getCachedAdminPriceListDetail(id);
}
