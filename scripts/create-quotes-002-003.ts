import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { unitPriceForProduct, lineTotal } from "../src/lib/pricing";
import {
  effectiveDiscountPriceListId,
  getPriceListUnitPricesByProductId,
} from "../src/lib/price-list-resolve";

const db = new PrismaClient();
assertSafeDestructiveDb();

async function nextQuoteNumber(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.quoteSequence.findUnique({ where: { id: 1 } });
  let seq: number;
  if (!existing) {
    await tx.quoteSequence.create({ data: { id: 1, value: 1 } });
    seq = 1;
  } else {
    const updated = await tx.quoteSequence.update({
      where: { id: 1 },
      data: { value: { increment: 1 } },
    });
    seq = updated.value;
  }
  return `R-${String(seq).padStart(6, "0")}`;
}

async function createQuoteForCustomer(code: string, productOffset: number) {
  const customer = await db.customer.findUnique({ where: { code } });
  if (!customer) throw new Error(`Customer ${code} not found`);

  const products = await db.product.findMany({
    where: { active: true, basePrice: { gt: 0 } },
    orderBy: { code: "asc" },
    take: 8,
  });
  if (products.length < 2) throw new Error("Need at least 2 active products with price > 0");

  const picked = products.slice(productOffset, productOffset + 3);
  if (picked.length < 2) {
    picked.push(...products.slice(0, 3 - picked.length));
  }

  const discountListId = await effectiveDiscountPriceListId(
    customer.priceListId,
  );
  const listPrices = discountListId
    ? await getPriceListUnitPricesByProductId(discountListId)
    : null;

  const qtys = [2, 1.5, 3];

  const quote = await db.$transaction(async (tx) => {
    const number = await nextQuoteNumber(tx);

    const items = picked.map((p, i) => {
      const unitPrice = unitPriceForProduct(
        p.basePrice,
        listPrices?.get(p.id) ?? null,
      );
      const qty = new Decimal(qtys[i] ?? 1);
      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        qty,
        unitPrice,
        lineTotal: lineTotal(unitPrice, qty),
      };
    });

    const total = items
      .reduce((acc, it) => acc.plus(it.lineTotal), new Decimal(0))
      .toDecimalPlaces(2);

    return tx.quote.create({
      data: {
        number,
        status: "SUBMITTED",
        customerId: customer.id,
        subtotal: total,
        total,
        items: { create: items },
      },
      include: { items: true },
    });
  });

  console.log(`Quote ${quote.number} for ${code}: ${quote.items.length} lines, total ${quote.total}`);
  return quote;
}

async function main() {
  await createQuoteForCustomer("002", 0);
  await createQuoteForCustomer("003", 3);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
