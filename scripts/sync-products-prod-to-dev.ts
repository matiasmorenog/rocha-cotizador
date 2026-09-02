/**
 * Copy all Product rows from Neon production → development (upsert by code).
 *
 * Read-only on production. Writes development only.
 *
 * Requires:
 *   CONFIRM_SYNC_PRODUCTS_PROD_TO_DEV=1
 *   DATABASE_URL_PRODUCTION or SOURCE_DATABASE_URL = Neon main direct (ep-cool-mud, no -pooler)
 *   DATABASE_URL = Neon development (ep-noisy-darkness)
 *
 * Usage:
 *   CONFIRM_SYNC_PRODUCTS_PROD_TO_DEV=1 tsx scripts/sync-products-prod-to-dev.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";

const PROD_HOST = "ep-cool-mud-a6k5vosf";

function hostname(url: string): string {
  return new URL(url.replace(/^postgresql:/i, "http:")).hostname.toLowerCase();
}

function assertProdSourceUrl(url: string) {
  const host = hostname(url);
  if (!host.includes(PROD_HOST)) {
    throw new Error(
      `SOURCE must be Neon production (host contains ${PROD_HOST}), got: ${host}`,
    );
  }
  console.log(`Source (read-only): ${host}`);
}

async function main() {
  if (process.env.CONFIRM_SYNC_PRODUCTS_PROD_TO_DEV !== "1") {
    throw new Error("Set CONFIRM_SYNC_PRODUCTS_PROD_TO_DEV=1 to run");
  }

  const sourceUrl =
    process.env.DATABASE_URL_PRODUCTION?.trim() ||
    process.env.SOURCE_DATABASE_URL?.trim();
  const targetUrl = process.env.DATABASE_URL?.trim();

  if (!sourceUrl) {
    throw new Error(
      "DATABASE_URL_PRODUCTION or SOURCE_DATABASE_URL required (Neon main direct)",
    );
  }
  if (!targetUrl) {
    throw new Error("DATABASE_URL required (Neon development target)");
  }

  assertProdSourceUrl(sourceUrl);
  assertSafeDestructiveDb(targetUrl);

  const source = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
  });
  const target = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  try {
    const products = await source.product.findMany({
      orderBy: { code: "asc" },
    });
    console.log(`Fetched ${products.length} products from production`);

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const p of products) {
      const data = {
        name: p.name,
        rubro: p.rubro,
        basePrice: p.basePrice,
        allowsUnitOrder: p.allowsUnitOrder,
        available: p.available,
        stockKind: p.stockKind,
      };

      try {
        const existing = await target.product.findUnique({
          where: { code: p.code },
          select: { id: true },
        });

        if (existing) {
          await target.product.update({
            where: { code: p.code },
            data,
          });
          updated++;
        } else {
          await target.product.create({
            data: { code: p.code, ...data },
          });
          created++;
        }
      } catch (err) {
        failed++;
        console.error(`Failed ${p.code}:`, err);
      }
    }

    const devOnly = await target.product.count({
      where: { code: { notIn: products.map((p) => p.code) } },
    });

    console.log(
      `Sync complete — created=${created}, updated=${updated}, failed=${failed}, dev-only-skus=${devOnly}`,
    );
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
