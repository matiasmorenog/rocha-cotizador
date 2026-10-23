import { db } from "@/lib/db";
import { filterFoldedSearch } from "@/lib/search-fold";

export type AdminProductSalesRow = {
  productCode: string;
  productName: string;
  /** Sum of qty on kg lines (allowsUnitOrder && !orderByUnit). */
  qtyKg: number;
  /** Sum of qty on unit lines (orderByUnit or fixed-quantity products). */
  qtyUnits: number;
  /** Sum of lineTotals (unit-order lines stay $0 until weighed). */
  amount: number;
};

export type AdminProductSalesResult = {
  rows: AdminProductSalesRow[];
  quoteCount: number;
  sumQuoteTotals: number;
};

function toNum(
  value: number | string | { toNumber?: () => number; toString: () => string },
): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return parseFloat(value.toString());
}

/**
 * Aggregate quote lines in [from, to) after the same search as Cotizaciones list
 * (number / customer code / name). Kg vs units follow remito measure rules.
 */
export async function getAdminQuotesProductSales(
  from: Date,
  to: Date,
  q = "",
): Promise<AdminProductSalesResult> {
  const quotesInRange = await db.quote.findMany({
    where: { createdAt: { gte: from, lt: to } },
    select: {
      id: true,
      number: true,
      total: true,
      customer: { select: { code: true, name: true } },
      items: {
        select: {
          productCode: true,
          productName: true,
          qty: true,
          orderByUnit: true,
          lineTotal: true,
          productId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const quotes = filterFoldedSearch(quotesInRange, q, {
    primary: [(row) => row.number, (row) => row.customer.code],
    secondary: [(row) => row.customer.name],
    emptyReturnsAll: true,
  });

  const productIds = [
    ...new Set(
      quotes.flatMap((quote) =>
        quote.items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, allowsUnitOrder: true },
        })
      : [];
  const allowsUnitOrderByProductId = new Map(
    products.map((p) => [p.id, p.allowsUnitOrder]),
  );

  type Acc = {
    productCode: string;
    productName: string;
    qtyKg: number;
    qtyUnits: number;
    amount: number;
  };
  const byCode = new Map<string, Acc>();

  for (const quote of quotes) {
    for (const item of quote.items) {
      const qty = toNum(item.qty);
      if (!Number.isFinite(qty) || qty === 0) continue;

      const allowsUnitOrder = item.productId
        ? (allowsUnitOrderByProductId.get(item.productId) ?? false)
        : false;
      const orderByUnit = item.orderByUnit === true;
      const isKg = allowsUnitOrder && !orderByUnit;

      const prev = byCode.get(item.productCode);
      const next: Acc = prev ?? {
        productCode: item.productCode,
        productName: item.productName,
        qtyKg: 0,
        qtyUnits: 0,
        amount: 0,
      };
      if (isKg) next.qtyKg += qty;
      else next.qtyUnits += qty;
      next.amount += toNum(item.lineTotal);
      // Prefer latest non-empty name if codes collide with renames.
      if (item.productName) next.productName = item.productName;
      byCode.set(item.productCode, next);
    }
  }

  const rows = [...byCode.values()].sort((a, b) =>
    a.productCode.localeCompare(b.productCode, "es", { numeric: true }),
  );

  const sumQuoteTotals = quotes.reduce((acc, quote) => {
    const n = toNum(quote.total);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

  return {
    rows,
    quoteCount: quotes.length,
    sumQuoteTotals,
  };
}
