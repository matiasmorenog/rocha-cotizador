/**
 * Upsert the 12 missing yellow LPM unit-order SKUs into Neon production.
 * Also creates PriceListItem rows for every existing PriceList (typically 5).
 *
 * Does NOT full-seed: no customers, no PIN reset, no purge.
 *
 * Requires:
 *   CONFIRM_PROD_BACKFILL=1
 *   DATABASE_URL = Neon main direct (ep-cool-mud, no -pooler)
 *
 * After a successful run, scripts/revalidate-app-cache.ts POSTs /api/revalidate
 * (REVALIDATE_SECRET + AUTH_URL or APP_URL). Warns on failure; does not abort.
 *
 * Usage:
 *   CONFIRM_PROD_BACKFILL=1 DATABASE_URL='postgresql://…@ep-cool-mud-….neon.tech/neondb?sslmode=require' \
 *     npx tsx scripts/prod-upsert-unit-order-skus.ts
 */
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import {
  BASE_PRICE_LIST_EXCEL_KEY,
  EXCEL_PRICE_LIST_DEFAULTS,
} from "../src/lib/pricing";
import { cellNumber, cellText } from "../src/lib/admin-excel";
import { revalidateAppCache } from "./revalidate-app-cache";

const PROD_HOST = "ep-cool-mud-a6k5vosf";

/** Yellow LPM codes missing from prod catalog (2026-07-24). */
const TARGET_CODES = [
  "0002",
  "0003",
  "0011",
  "20001",
  "20002",
  "20003",
  "20004",
  "20005",
  "20006",
  "20007",
  "20008",
  "20009",
] as const;

function normalizeCode(codeRaw: string): string {
  return codeRaw.length <= 4 ? codeRaw.padStart(4, "0") : codeRaw;
}

function assertProdUrl(url: string) {
  if (process.env.CONFIRM_PROD_BACKFILL !== "1") {
    throw new Error("Set CONFIRM_PROD_BACKFILL=1 to run this script");
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }
  if (!host.includes(PROD_HOST)) {
    throw new Error(`Refusing non-prod host: ${host}`);
  }
  if (host.includes("-pooler")) {
    throw new Error(`Use direct (non-pooler) URL, got: ${host}`);
  }
  console.log(`Target host OK: ${host}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  assertProdUrl(url);

  const db = new PrismaClient();
  const xlsxPath = path.join(__dirname, "../prisma/data/rocha_data.xlsx");
  const want = new Set<string>(TARGET_CODES);

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);
    const sheet = workbook.getWorksheet("Lista de Precios");
    if (!sheet) throw new Error('Missing sheet "Lista de Precios"');

    type ExcelRow = {
      code: string;
      name: string;
      rubro: string | null;
      basePrice: number;
      listPrices: Record<string, number>;
    };
    const byCode = new Map<string, ExcelRow>();

    for (let r = 5; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const codeRaw = cellText(row.getCell(1).value);
      if (!/^\d+$/.test(codeRaw)) continue;
      const code = normalizeCode(codeRaw);
      if (!want.has(code) && !want.has(codeRaw)) continue;

      const name = cellText(row.getCell(3).value);
      if (!name) continue;
      const rubro = cellText(row.getCell(2).value) || null;
      // Yellow unit-order SKUs often have empty / $0 until weighed.
      const baseRaw = cellNumber(row.getCell(5).value);
      const basePrice = baseRaw !== null && baseRaw >= 0 ? baseRaw : 0;

      const listPrices: Record<string, number> = {
        [BASE_PRICE_LIST_EXCEL_KEY]: basePrice,
      };
      for (const [excelKey, meta] of Object.entries(EXCEL_PRICE_LIST_DEFAULTS)) {
        const unitPrice = cellNumber(row.getCell(meta.column).value);
        listPrices[excelKey] =
          unitPrice !== null && unitPrice > 0 ? unitPrice : basePrice;
      }

      byCode.set(code, { code, name, rubro, basePrice, listPrices });
    }

    const missingExcel = TARGET_CODES.filter((c) => !byCode.has(c));
    if (missingExcel.length > 0) {
      throw new Error(`Codes missing from Excel: ${missingExcel.join(", ")}`);
    }

    const priceLists = await db.priceList.findMany({
      select: { id: true, excelKey: true, name: true, isBase: true },
    });
    if (priceLists.length === 0) {
      throw new Error("No PriceLists in prod — run price-list backfill first");
    }
    console.log(
      `PriceLists (${priceLists.length}): ${priceLists.map((l) => l.excelKey ?? l.name).join(", ")}`,
    );

    let created = 0;
    let updated = 0;
    let itemsUpserted = 0;
    const createdCodes: string[] = [];
    const updatedCodes: string[] = [];

    for (const code of TARGET_CODES) {
      const row = byCode.get(code)!;
      const existing = await db.product.findUnique({ where: { code } });

      const product = await db.product.upsert({
        where: { code },
        create: {
          code,
          name: row.name,
          rubro: row.rubro,
          basePrice: row.basePrice,
          allowsUnitOrder: true,
          active: true,
        },
        update: {
          name: row.name,
          rubro: row.rubro,
          // Keep a positive DB price if Excel still says $0.
          ...(existing &&
          Number(existing.basePrice) > 0 &&
          row.basePrice === 0
            ? {}
            : { basePrice: row.basePrice }),
          allowsUnitOrder: true,
          active: true,
        },
      });

      const effectiveBase =
        existing && Number(existing.basePrice) > 0 && row.basePrice === 0
          ? Number(existing.basePrice)
          : row.basePrice;

      for (const list of priceLists) {
        const fromExcel =
          list.excelKey != null ? row.listPrices[list.excelKey] : undefined;
        const unitPrice =
          fromExcel !== undefined ? fromExcel : effectiveBase;

        await db.priceListItem.upsert({
          where: {
            priceListId_productId: {
              priceListId: list.id,
              productId: product.id,
            },
          },
          create: {
            priceListId: list.id,
            productId: product.id,
            unitPrice,
          },
          update: { unitPrice },
        });
        itemsUpserted += 1;
      }

      if (existing) {
        updated += 1;
        updatedCodes.push(code);
        console.log(`upd ${code} ${row.name}`);
      } else {
        created += 1;
        createdCodes.push(code);
        console.log(`new ${code} ${row.name} @ ${row.basePrice}`);
      }
    }

    // Verify
    const codes = [...TARGET_CODES];
    const products = await db.product.findMany({
      where: { code: { in: codes } },
      select: {
        id: true,
        code: true,
        allowsUnitOrder: true,
        active: true,
        _count: { select: { priceListItems: true } },
      },
      orderBy: { code: "asc" },
    });
    const flagged = products.filter((p) => p.allowsUnitOrder).length;
    const withAllLists = products.filter(
      (p) => p._count.priceListItems >= priceLists.length,
    ).length;
    const itemCount = await db.priceListItem.count({
      where: { productId: { in: products.map((p) => p.id) } },
    });

    console.log("---");
    console.log(`created=${created} [${createdCodes.join(", ")}]`);
    console.log(`updated=${updated} [${updatedCodes.join(", ") || "—"}]`);
    console.log(`priceListItems upserted=${itemsUpserted}`);
    console.log(
      `VERIFY products=${products.length}/${codes.length} allowsUnitOrder=${flagged}/${codes.length} items=${itemCount} (expect ${codes.length * priceLists.length}) withAllLists=${withAllLists}/${codes.length}`,
    );

    await revalidateAppCache();
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
