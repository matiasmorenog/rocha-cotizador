/**
 * Dev-only: wipe all quotes/remitos and seed random SUBMITTED quotes for testing
 * Cotizaciones (lista, PDF export, por producto).
 *
 * Touches: Quote, QuoteItem, QuoteSequence, AdminInboxItem (cleared).
 * Does NOT touch: customers, products, price lists, users, stock, settings.
 *
 * Safety: assertSafeDestructiveDb() — Neon main blocked; needs SEED_TARGET=development
 * (or ALLOW_DESTRUCTIVE_DB=1 on non-prod).
 *
 * Usage:
 *   npm run dev:seed-quotes
 *   QUOTE_COUNT=60 DAYS_BACK=30 npm run dev:seed-quotes
 *
 * Optional env:
 *   QUOTE_COUNT — how many quotes to create (default 45)
 *   DAYS_BACK   — spread createdAt over last N Argentina calendar days (default 35)
 */
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { ARGENTINA_TZ } from "../src/lib/argentina-time";
import { addCalendarDaysYmd } from "../src/lib/delivery-date";
import { lineTotal, unitPriceForProduct } from "../src/lib/pricing";
import {
  effectiveDiscountPriceListId,
  getPriceListUnitPricesByProductId,
} from "../src/lib/price-list-resolve";
import { revalidateAppCache } from "./revalidate-app-cache";

const db = new PrismaClient();
assertSafeDestructiveDb();

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer ${min}..${max}, got ${raw}`);
  }
  return n;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickN<T>(items: readonly T[], n: number): T[] {
  if (items.length === 0) return [];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function argentinaYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** UTC noon on Argentina calendar day → stable @db.Date + createdAt spread. */
function utcNoonFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 15, 0, 0)); // ~12:00 AR (UTC-3)
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

type ProductRow = {
  id: string;
  code: string;
  name: string;
  basePrice: Decimal;
  allowsUnitOrder: boolean;
};

async function wipeQuotes() {
  const deleted = await db.$transaction(async (tx) => {
    const inbox = await tx.adminInboxItem.deleteMany({});
    const items = await tx.quoteItem.deleteMany({});
    const quotes = await tx.quote.deleteMany({});
    await tx.quoteSequence.upsert({
      where: { id: 1 },
      create: { id: 1, value: 0 },
      update: { value: 0 },
    });
    return {
      inbox: inbox.count,
      items: items.count,
      quotes: quotes.count,
    };
  });
  console.log(
    `Wiped: quotes=${deleted.quotes} items=${deleted.items} inbox=${deleted.inbox}; QuoteSequence → 0`,
  );
}

async function main() {
  const quoteCount = envInt("QUOTE_COUNT", 45, 1, 500);
  const daysBack = envInt("DAYS_BACK", 35, 1, 365);

  const customers = await db.customer.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, priceListId: true },
    orderBy: { code: "asc" },
  });
  if (customers.length === 0) {
    throw new Error("No active customers — run seed / npm run dev:wipe-customers first");
  }

  const products = (await db.product.findMany({
    where: { available: true },
    select: {
      id: true,
      code: true,
      name: true,
      basePrice: true,
      allowsUnitOrder: true,
    },
    orderBy: { code: "asc" },
  })) as ProductRow[];
  if (products.length < 2) {
    throw new Error("Need at least 2 available products");
  }

  console.log(
    `Seeding ${quoteCount} quotes over last ${daysBack} days · customers=${customers.length} products=${products.length}`,
  );

  await wipeQuotes();

  const todayYmd = argentinaYmd();
  const listPriceCache = new Map<string, Map<string, Decimal> | null>();

  async function pricesForCustomer(priceListId: string | null) {
    const listId = await effectiveDiscountPriceListId(priceListId);
    const key = listId ?? "__base__";
    if (listPriceCache.has(key)) return listPriceCache.get(key)!;
    const map = listId
      ? await getPriceListUnitPricesByProductId(listId)
      : null;
    listPriceCache.set(key, map);
    return map;
  }

  let created = 0;
  for (let i = 0; i < quoteCount; i++) {
    const customer = customers[randInt(0, customers.length - 1)]!;
    const listPrices = await pricesForCustomer(customer.priceListId);
    const lineCount = randInt(2, Math.min(14, products.length));
    const picked = pickN(products, lineCount);

    const dayOffset = randInt(0, daysBack - 1);
    const orderYmd = addCalendarDaysYmd(todayYmd, -dayOffset);
    const deliveryYmd = addCalendarDaysYmd(orderYmd, randInt(0, 2));
    const createdAt = utcNoonFromYmd(orderYmd);
    createdAt.setUTCHours(
      createdAt.getUTCHours(),
      randInt(0, 59),
      randInt(0, 59),
      0,
    );
    const deliveryDate = utcNoonFromYmd(deliveryYmd);

    const quote = await db.$transaction(async (tx) => {
      const number = await nextQuoteNumber(tx);

      const items = picked.map((p) => {
        const orderByUnit =
          p.allowsUnitOrder && Math.random() < 0.35;
        const qty = orderByUnit
          ? new Decimal(randInt(1, 24))
          : p.allowsUnitOrder
            ? new Decimal((randInt(5, 80) / 10).toFixed(1))
            : new Decimal(randInt(1, 20));

        const unitPrice = orderByUnit
          ? new Decimal(0)
          : unitPriceForProduct(
              p.basePrice,
              listPrices?.get(p.id) ?? null,
            );
        const line = orderByUnit
          ? new Decimal(0)
          : lineTotal(unitPrice, qty);

        return {
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          qty,
          orderByUnit,
          unitPrice,
          lineTotal: line,
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
          notes: Math.random() < 0.25 ? "Pedido de prueba (dev seed)" : null,
          deliveryDate,
          createdAt,
          items: { create: items },
        },
        select: { number: true, total: true, _count: { select: { items: true } } },
      });
    });

    created += 1;
    if (created <= 5 || created === quoteCount) {
      console.log(
        `  ${quote.number} · ${customer.code} ${customer.name} · ${quote._count.items} líneas · $${quote.total}`,
      );
    }
  }

  const after = await db.quote.count();
  const seq = await db.quoteSequence.findUnique({ where: { id: 1 } });
  console.log(
    `Done: quotes=${after} QuoteSequence.value=${seq?.value ?? "?"} (next remito R-${String((seq?.value ?? 0) + 1).padStart(6, "0")})`,
  );

  await revalidateAppCache();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
