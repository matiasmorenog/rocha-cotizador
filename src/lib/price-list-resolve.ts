import { Decimal } from "@prisma/client/runtime/library";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { unitPriceForProduct } from "@/lib/pricing";
import { getActiveProductsBase } from "@/lib/products-cache";

/** Load unit prices for a price list keyed by product id. */
export async function getPriceListUnitPricesByProductId(
  priceListId: string,
): Promise<Map<string, Decimal>> {
  const items = await db.priceListItem.findMany({
    where: { priceListId },
    select: { productId: true, unitPrice: true },
  });
  return new Map(items.map((i) => [i.productId, i.unitPrice]));
}

/** Singleton Precio base list (isBase=true). */
export async function getBasePriceList(): Promise<{
  id: string;
  name: string;
} | null> {
  return db.priceList.findFirst({
    where: { isBase: true },
    select: { id: true, name: true },
  });
}

/**
 * null or isBase list → use Product.basePrice (no list overrides).
 * Discount lists → return id for override lookup.
 */
export async function effectiveDiscountPriceListId(
  priceListId: string | null | undefined,
): Promise<string | null> {
  if (!priceListId) return null;
  const list = await db.priceList.findUnique({
    where: { id: priceListId },
    select: { isBase: true },
  });
  if (!list || list.isBase) return null;
  return priceListId;
}

export type CustomerPricingContext = {
  priceListId: string | null;
  active: boolean;
};

/**
 * Cached customerId → priceListId (+ active). Invalidate via `customers` tag
 * on customer mutate and price-list delete (reassigns customers).
 */
export async function getCachedCustomerPricingContext(
  customerId: string,
): Promise<CustomerPricingContext | null> {
  const cached = unstable_cache(
    async (): Promise<CustomerPricingContext | null> => {
      const customer = await db.customer.findUnique({
        where: { id: customerId },
        select: { priceListId: true, active: true },
      });
      return customer;
    },
    ["customer-pricing-context", customerId],
    { tags: [CACHE_TAGS.customers], revalidate: 86400 },
  );
  return cached();
}

/** Resolve customer priceListId (null / isBase → treat as Precio base). */
export async function getCustomerPriceListId(
  customerId: string,
): Promise<string | null> {
  const customer = await getCachedCustomerPricingContext(customerId);
  return customer?.priceListId ?? null;
}

/**
 * Map product code → unit price for catalog/search.
 * Base / isBase → Product.basePrice; else list overrides with base fallback.
 */
export async function resolveUnitPricesForList(
  products: Array<{ id: string; code: string; basePrice: Decimal | number }>,
  priceListId: string | null,
): Promise<Record<string, number>> {
  const discountListId = await effectiveDiscountPriceListId(priceListId);
  const overrides =
    discountListId != null
      ? await getPriceListUnitPricesByProductId(discountListId)
      : null;

  const out: Record<string, number> = {};
  for (const p of products) {
    const listPrice = overrides?.get(p.id);
    out[p.code] = Number(
      unitPriceForProduct(p.basePrice, listPrice ?? null),
    );
  }
  return out;
}

/**
 * Catalog unitPrices map cached by version + list.
 * Invalidated with products / price-lists tags after admin mutations.
 */
export async function getCachedUnitPricesForCatalog(
  priceListId: string | null,
  catalogVersion: string,
): Promise<Record<string, number>> {
  const listKey = priceListId ?? "base";
  const cached = unstable_cache(
    async () => {
      const products = await getActiveProductsBase();
      return resolveUnitPricesForList(
        products.map((p) => ({
          id: p.id,
          code: p.code,
          basePrice: p.basePrice,
        })),
        priceListId,
      );
    },
    ["catalog-unit-prices", listKey, catalogVersion],
    {
      tags: [CACHE_TAGS.products, CACHE_TAGS.priceLists],
      revalidate: 86400,
    },
  );
  return cached();
}

/** Keep base PriceListItem in sync when Product.basePrice changes. */
export async function syncBaseListItemForProduct(
  productId: string,
  basePrice: Decimal | number | string,
): Promise<void> {
  const base = await getBasePriceList();
  if (!base) return;
  await db.priceListItem.upsert({
    where: {
      priceListId_productId: {
        priceListId: base.id,
        productId,
      },
    },
    create: {
      priceListId: base.id,
      productId,
      unitPrice: basePrice,
    },
    update: { unitPrice: basePrice },
  });
}
