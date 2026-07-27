/**
 * Wipe all quotes/items and reset remito number sequence (QuoteSequence → 0).
 * Next quote via nextQuoteNumber() will be R-000001.
 *
 * Does NOT touch customers, products, price lists, users, BusinessSettings.
 *
 * Requires:
 *   CONFIRM_WIPE_QUOTES=1
 *   TARGET=development|production
 *   DATABASE_URL = Neon direct URL matching TARGET (no -pooler)
 *
 * Optional (bust Vercel Data Cache / route cache after wipe):
 *   REVALIDATE_SECRET + AUTH_URL (or APP_URL) — POST /api/revalidate
 *
 * Examples:
 *   CONFIRM_WIPE_QUOTES=1 TARGET=development npx tsx scripts/wipe-quotes-reset-remito.ts
 *   CONFIRM_WIPE_QUOTES=1 TARGET=production DATABASE_URL='postgresql://…@ep-cool-mud-….neon.tech/neondb?sslmode=require' \
 *     REVALIDATE_SECRET='…' AUTH_URL='https://rocha-cotizador.vercel.app' \
 *     npx tsx scripts/wipe-quotes-reset-remito.ts
 */
import { PrismaClient } from "@prisma/client";

const DEV_HOST = "ep-noisy-darkness-a6ms81wq";
const PROD_HOST = "ep-cool-mud-a6k5vosf";

type Target = "development" | "production";

function parseTarget(raw: string | undefined): Target {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "development" || t === "production") return t;
  throw new Error('TARGET must be "development" or "production"');
}

function assertTargetUrl(url: string, target: Target) {
  if (process.env.CONFIRM_WIPE_QUOTES !== "1") {
    throw new Error("Set CONFIRM_WIPE_QUOTES=1 to run this script");
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }

  if (host.includes("-pooler")) {
    throw new Error(`Use direct (non-pooler) URL, got: ${host}`);
  }

  const expected = target === "production" ? PROD_HOST : DEV_HOST;
  if (!host.includes(expected)) {
    throw new Error(
      `Refusing TARGET=${target}: host ${host} does not contain ${expected}`,
    );
  }

  console.log(`Target OK: TARGET=${target} host=${host}`);
}

async function revalidateAppCache() {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const base = (
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    ""
  ).replace(/\/$/, "");

  if (!secret || !base) {
    console.warn(
      "Skip app revalidate: set REVALIDATE_SECRET and AUTH_URL (or APP_URL) to bust Vercel cache after wipe.",
    );
    return;
  }

  const res = await fetch(`${base}/api/revalidate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Revalidate failed (${res.status}): ${body}`);
  }
  console.log(`App cache revalidated via ${base}/api/revalidate`);
}

async function main() {
  const target = parseTarget(process.env.TARGET);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  assertTargetUrl(url, target);

  const db = new PrismaClient();

  try {
    const before = await db.$transaction(async (tx) => {
      const [quotes, items, seq] = await Promise.all([
        tx.quote.count(),
        tx.quoteItem.count(),
        tx.quoteSequence.findUnique({ where: { id: 1 } }),
      ]);
      return { quotes, items, seqValue: seq?.value ?? null };
    });

    console.log(
      `Before: quotes=${before.quotes} items=${before.items} QuoteSequence.value=${before.seqValue}`,
    );

    // QuoteItem has onDelete: Cascade; delete quotes first is enough.
    // Explicit item delete keeps counts clear if cascade order differs.
    const deleted = await db.$transaction(async (tx) => {
      const items = await tx.quoteItem.deleteMany({});
      const quotes = await tx.quote.deleteMany({});
      await tx.quoteSequence.upsert({
        where: { id: 1 },
        create: { id: 1, value: 0 },
        update: { value: 0 },
      });
      return { items: items.count, quotes: quotes.count };
    });

    console.log(
      `Deleted: quotes=${deleted.quotes} items=${deleted.items}; QuoteSequence.value → 0`,
    );

    const after = await db.$transaction(async (tx) => {
      const [quotes, items, seq, customers, products, users] =
        await Promise.all([
          tx.quote.count(),
          tx.quoteItem.count(),
          tx.quoteSequence.findUnique({ where: { id: 1 } }),
          tx.customer.count(),
          tx.product.count(),
          tx.user.count(),
        ]);
      return {
        quotes,
        items,
        seqValue: seq?.value ?? null,
        customers,
        products,
        users,
      };
    });

    console.log(
      `After: quotes=${after.quotes} items=${after.items} QuoteSequence.value=${after.seqValue}`,
    );
    console.log(
      `Untouched: customers=${after.customers} products=${after.products} users=${after.users}`,
    );
    console.log("Next remito number will be: R-000001");

    if (after.quotes !== 0 || after.items !== 0 || after.seqValue !== 0) {
      throw new Error("Post-wipe verification failed");
    }

    await revalidateAppCache();
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
