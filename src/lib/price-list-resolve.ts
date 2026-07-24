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

/** Resolve customer priceListId (null = Precio base / Product.basePrice). */
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
 * Base products + optional list overrides.
 */
export async function resolveUnitPricesForList(
  products: Array<{ id: string; code: string; basePrice: Decimal | number }>,
  priceListId: string | null,
): Promise<Record<string, number>> {
  const overrides =
    priceListId != null
      ? await getPriceListUnitPricesByProductId(priceListId)
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
