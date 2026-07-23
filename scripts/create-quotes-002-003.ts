import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";

const db = new PrismaClient();
assertSafeDestructiveDb();

function priceForCustomer(
  basePrice: Decimal | number | string,
  discountPercent: Decimal | number | string,
): Decimal {
  const base = new Decimal(basePrice);
  const discount = new Decimal(discountPercent);
  const factor = new Decimal(1).minus(discount.div(100));
  return base.mul(factor).toDecimalPlaces(2);
}

function lineTotal(unitPrice: Decimal, qty: Decimal | number | string): Decimal {
  return unitPrice.mul(new Decimal(qty)).toDecimalPlaces(2);
}

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

  const qtys = [2, 1.5, 3];

  const quote = await db.$transaction(async (tx) => {
    const number = await nextQuoteNumber(tx);

    const items = picked.map((p, i) => {
      const unitPrice = priceForCustomer(p.basePrice, customer.discountPercent);
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
        notes: `Seed quote for customer ${code}`,
        items: { create: items },
      },
      select: { number: true, total: true },
    });
  });

  return { code, number: quote.number, total: quote.total.toString() };
}

async function main() {
  const r002 = await createQuoteForCustomer("002", 0);
  const r003 = await createQuoteForCustomer("003", 3);
  console.log(`${r002.code} ${r002.number} ${r002.total}`);
  console.log(`${r003.code} ${r003.number} ${r003.total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
