import { Decimal } from "@prisma/client/runtime/library";

/** Effective unit price for a customer. Never expose discountPercent to clients. */
export function priceForCustomer(
  basePrice: Decimal | number | string,
  discountPercent: Decimal | number | string,
): Decimal {
  const base = new Decimal(basePrice);
  const discount = new Decimal(discountPercent);
  const factor = new Decimal(1).minus(discount.div(100));
  return base.mul(factor).toDecimalPlaces(2);
}

export function lineTotal(unitPrice: Decimal, qty: Decimal | number | string): Decimal {
  return unitPrice.mul(new Decimal(qty)).toDecimalPlaces(2);
}

/** Map Excel price list number → initial discount %. Lista 5 / empty = 0. */
export function discountFromExcelLista(lista: string | number | null | undefined): number {
  if (lista === null || lista === undefined) return 0;
  const key = String(lista).trim();
  const map: Record<string, number> = {
    "6": 20,
    "7": 15,
    "8": 10,
    "9": 5,
  };
  return map[key] ?? 0;
}
