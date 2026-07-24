import { Decimal } from "@prisma/client/runtime/library";
import { db } from "@/lib/db";
import { unitPriceForProduct } from "@/lib/pricing";

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

/** Resolve customer priceListId (null / isBase → treat as Precio base). */
export async function getCustomerPriceListId(
  customerId: string,
): Promise<string | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { priceListId: true },
  });
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
