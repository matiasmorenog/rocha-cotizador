/**
 * Dev-only: wipe all quotes/remitos and seed SUBMITTED quotes for testing
 * Cotizaciones (lista, PDF export, por producto) + admin dashboard demo.
 *
 * Touches: Quote, QuoteItem, QuoteSequence, AdminInboxItem (cleared).
 * Does NOT touch: customers, products, price lists, users, stock, settings.
 *
 * Distribution (demo-friendly):
 *   - MoM growth across months in range (counts + cart size → year chart rising)
 *   - Dense today + last 7 Argentina days (KPIs / week chart not empty)
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

function yearMonthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

/** Month keys from oldest day in range through today (inclusive). */
function monthKeysInRange(todayYmd: string, daysBack: number): string[] {
  const startYmd = addCalendarDaysYmd(todayYmd, -(daysBack - 1));
  const months: string[] = [];
  let y = Number(startYmd.slice(0, 4));
  let m = Number(startYmd.slice(5, 7));
  const endY = Number(todayYmd.slice(0, 4));
  const endM = Number(todayYmd.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

/** Growing integer allocation across months (commerce MoM up). */
function allocateCountsByMonth(
  months: readonly string[],
  total: number,
): Map<string, number> {
  if (months.length === 0) return new Map();
  // Power curve: early months thin, latest months thick.
  const weights = months.map((_, i) => Math.pow(i + 1, 1.55));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.floor((w / weightSum) * total));
  let remaining = total - counts.reduce((a, b) => a + b, 0);
  // Remainder → newest months first (stronger growth tip).
  for (let i = counts.length - 1; remaining > 0; i -= 1, remaining -= 1) {
    counts[Math.max(0, i)]! += 1;
  }
  return new Map(months.map((ym, i) => [ym, counts[i]!]));
}

/**
 * Day offsets (0 = today) for every quote, biased for demo UI:
 * - MoM rising counts across the year window (no empty early months)
 * - Guaranteed today + dense last 7 days (taken from current-month surplus)
 */
function buildBiasedDayOffsets(quoteCount: number, daysBack: number, todayYmd: string): number[] {
  const months = monthKeysInRange(todayYmd, daysBack);
  const byMonth = allocateCountsByMonth(months, quoteCount);
  const currentYm = yearMonthOf(todayYmd);

  // Floor so year chart never shows blank early months after recent bias.
  const minPerMonth = Math.max(
    3,
    Math.min(8, Math.floor(quoteCount / Math.max(months.length * 4, 1))),
  );
  for (const ym of months) {
    const cur = byMonth.get(ym) ?? 0;
    if (cur < minPerMonth) byMonth.set(ym, minPerMonth);
  }
  // Re-normalize to quoteCount after floors.
  // Trim surplus from older months first — keep tip (current month) strongest.
  let sum = [...byMonth.values()].reduce((a, b) => a + b, 0);
  if (sum > quoteCount) {
    let overflow = sum - quoteCount;
    for (let i = 0; i < months.length && overflow > 0; i++) {
      const ym = months[i]!;
      if (ym === currentYm) continue;
      const cur = byMonth.get(ym) ?? 0;
      const canCut = Math.max(0, cur - minPerMonth);
      const cut = Math.min(canCut, overflow);
      byMonth.set(ym, cur - cut);
      overflow -= cut;
    }
    // Last resort: trim current month above floor.
    if (overflow > 0) {
      const cur = byMonth.get(currentYm) ?? 0;
      const cut = Math.min(Math.max(0, cur - minPerMonth), overflow);
      byMonth.set(currentYm, cur - cut);
    }
  } else if (sum < quoteCount) {
    // Extra → current month (feeds today/last-7).
    byMonth.set(currentYm, (byMonth.get(currentYm) ?? 0) + (quoteCount - sum));
  }

  const minToday = Math.min(
    quoteCount,
    Math.max(10, Math.round(quoteCount * 0.05)),
  );
  const minLast7 = Math.min(
    quoteCount,
    Math.max(minToday + 16, Math.round(quoteCount * 0.16)),
  );

  // Ensure current month can cover today + last-7 without emptying older months.
  const currentNeed = Math.max(minLast7, byMonth.get(currentYm) ?? 0);
  let currentHave = byMonth.get(currentYm) ?? 0;
  if (currentHave < currentNeed) {
    let need = currentNeed - currentHave;
    for (let i = 0; i < months.length && need > 0; i++) {
      const ym = months[i]!;
      if (ym === currentYm) continue;
      const cur = byMonth.get(ym) ?? 0;
      const canGive = Math.max(0, cur - minPerMonth);
      const give = Math.min(canGive, need);
      if (give > 0) {
        byMonth.set(ym, cur - give);
        need -= give;
      }
    }
    byMonth.set(currentYm, currentHave + (currentNeed - currentHave - need));
  }

  const daysInMonth = (ym: string): number[] => {
    const offsets: number[] = [];
    for (let offset = 0; offset < daysBack; offset++) {
      if (yearMonthOf(addCalendarDaysYmd(todayYmd, -offset)) === ym) {
        offsets.push(offset);
      }
    }
    return offsets;
  };

  const pickWeightedOffset = (candidates: readonly number[]): number => {
    if (candidates.length === 0) return 0;
    const weights = candidates.map((offset) => {
      let w = 1;
      if (offset === 0) w = 14;
      else if (offset <= 2) w = 7;
      else if (offset <= 6) w = 4;
      else if (offset <= 13) w = 2;
      return w;
    });
    const sumW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sumW;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return candidates[i]!;
    }
    return candidates[candidates.length - 1]!;
  };

  const offsets: number[] = [];
  for (const ym of months) {
    const n = byMonth.get(ym) ?? 0;
    const candidates = daysInMonth(ym);
    if (candidates.length === 0 || n === 0) continue;

    if (ym === currentYm) {
      // Pin today + recent days first, then fill rest of month.
      const pinned: number[] = [];
      for (let t = 0; t < minToday && pinned.length < n; t++) pinned.push(0);
      const recentPool = candidates.filter((o) => o >= 1 && o <= 6);
      while (pinned.length < Math.min(n, minLast7) && recentPool.length > 0) {
        pinned.push(recentPool[randInt(0, recentPool.length - 1)]!);
      }
      while (pinned.length < n) {
        pinned.push(pickWeightedOffset(candidates));
      }
      offsets.push(...pinned);
    } else {
      for (let i = 0; i < n; i++) {
        offsets.push(pickWeightedOffset(candidates));
      }
    }
  }

  // If total drifted (edge), trim or pad to quoteCount.
  while (offsets.length > quoteCount) offsets.pop();
  while (offsets.length < quoteCount) {
    const curDays = daysInMonth(currentYm);
    offsets.push(pickWeightedOffset(curDays.length ? curDays : [0]));
  }

  // Shuffle so create order ≠ chronological dump.
  for (let i = offsets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [offsets[i], offsets[j]] = [offsets[j]!, offsets[i]!];
  }
  return offsets;
}

/** Cart size / qty scale by month index (0..1) — revenue MoM growth. */
function monthCommerceScale(monthIndex: number, monthCount: number): number {
  if (monthCount <= 1) return 1;
  const t = monthIndex / (monthCount - 1);
  // ~0.55 early year → ~1.15 current month
  return 0.55 + 0.6 * t;
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

  const todayYmd = argentinaYmd();
  const months = monthKeysInRange(todayYmd, daysBack);
  const monthIndex = new Map(months.map((ym, i) => [ym, i]));
  const dayOffsets = buildBiasedDayOffsets(quoteCount, daysBack, todayYmd);
  const todayPlanned = dayOffsets.filter((o) => o === 0).length;
  const last7Planned = dayOffsets.filter((o) => o <= 6).length;

  console.log(
    `Seeding ${quoteCount} quotes over last ${daysBack} days · customers=${customers.length} products=${products.length}`,
  );
  console.log(
    `  bias: MoM growth across ${months.length} months · planned today=${todayPlanned} last7=${last7Planned}`,
  );

  await wipeQuotes();

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

    const dayOffset = dayOffsets[i] ?? randInt(0, daysBack - 1);
    const orderYmd = addCalendarDaysYmd(todayYmd, -dayOffset);
    const ym = yearMonthOf(orderYmd);
    const scale = monthCommerceScale(monthIndex.get(ym) ?? 0, months.length);

    const maxLines = Math.min(14, products.length);
    const baseLines = randInt(2, maxLines);
    const lineCount = Math.min(
      maxLines,
      Math.max(2, Math.round(baseLines * (0.75 + 0.5 * scale))),
    );
    const picked = pickN(products, lineCount);

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
        const qtyRaw = orderByUnit
          ? randInt(1, 24)
          : p.allowsUnitOrder
            ? randInt(5, 80) / 10
            : randInt(1, 20);
        const qtyScaled = qtyRaw * scale;
        const qty = orderByUnit
          ? new Decimal(Math.max(1, Math.round(qtyScaled)))
          : p.allowsUnitOrder
            ? new Decimal(Math.max(0.1, qtyScaled).toFixed(1))
            : new Decimal(Math.max(1, Math.round(qtyScaled)));

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
