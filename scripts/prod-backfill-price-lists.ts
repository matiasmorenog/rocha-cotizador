/**
 * One-shot prod backfill after schema push (PriceList model).
 * Does NOT seed/wipe: no PIN reset, no product create, no customer create.
 *
 * Requires:
 *   CONFIRM_PROD_BACKFILL=1
 *   DATABASE_URL = Neon main direct (ep-cool-mud, no -pooler)
 *
 * Customer→list map from pre-drop discountPercent snapshot (2026-07-24).
 */
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import {
  BASE_PRICE_LIST_EXCEL_KEY,
  BASE_PRICE_LIST_NAME,
  EXCEL_PRICE_LIST_DEFAULTS,
} from "../src/lib/pricing";
import { UNIT_ORDER_PRODUCT_CODES } from "../src/lib/unit-order-products";
import { cellNumber, cellText } from "../src/lib/admin-excel";

const PROD_HOST = "ep-cool-mud-a6k5vosf";

/** Pre-push snapshot: code → discountPercent (only >0). */
const DISCOUNT_BY_CODE: Record<string, number> = {
  "001": 20,
  "008": 5,
  "014": 15,
  "026": 5,
  "031": 15,
  "033": 5,
  "041": 20,
  "047": 20,
  "077": 20,
  "125": 20,
  "131": 20,
  "153": 15,
  "168": 20,
  "172": 15,
  "200": 20,
};

const PCT_TO_EXCEL_KEY: Record<number, string> = {
  20: "6",
  15: "7",
  10: "8",
  5: "9",
};

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

  try {
    // 1) Price lists
    await db.priceList.updateMany({
      where: { isBase: true, NOT: { excelKey: BASE_PRICE_LIST_EXCEL_KEY } },
      data: { isBase: false },
    });
    const base = await db.priceList.upsert({
      where: { excelKey: BASE_PRICE_LIST_EXCEL_KEY },
      create: {
        name: BASE_PRICE_LIST_NAME,
        excelKey: BASE_PRICE_LIST_EXCEL_KEY,
        isBase: true,
        active: true,
      },
      update: { isBase: true, name: BASE_PRICE_LIST_NAME },
    });
    const listByKey = new Map<string, string>([
      [BASE_PRICE_LIST_EXCEL_KEY, base.id],
    ]);
    for (const [excelKey, meta] of Object.entries(EXCEL_PRICE_LIST_DEFAULTS)) {
      const list = await db.priceList.upsert({
        where: { excelKey },
        create: { name: meta.name, excelKey, active: true, isBase: false },
        update: { isBase: false, name: meta.name },
      });
      listByKey.set(excelKey, list.id);
    }
    console.log(`PriceLists: ${[...listByKey.keys()].join(", ")}`);

    // 2) Excel list prices for products that already exist in prod
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);
    const pricesSheet = workbook.getWorksheet("Lista de Precios");
    if (!pricesSheet) throw new Error('Missing sheet "Lista de Precios"');

    const products = await db.product.findMany({
      select: { id: true, code: true, basePrice: true },
    });
    const byCode = new Map(products.map((p) => [p.code, p]));

    type RowPrices = { code: string; listPrices: Record<string, number> };
    const excelRows: RowPrices[] = [];
    for (let r = 5; r <= pricesSheet.rowCount; r++) {
      const row = pricesSheet.getRow(r);
      const codeRaw = cellText(row.getCell(1).value);
      if (!/^\d+$/.test(codeRaw)) continue;
      const code = codeRaw.padStart(4, "0");
      if (!byCode.has(code)) continue;

      const basePrice = cellNumber(row.getCell(5).value);
      if (basePrice === null || basePrice < 0) continue;

      const listPrices: Record<string, number> = {
        [BASE_PRICE_LIST_EXCEL_KEY]: basePrice,
      };
      for (const [excelKey, meta] of Object.entries(EXCEL_PRICE_LIST_DEFAULTS)) {
        const unitPrice = cellNumber(row.getCell(meta.column).value);
        if (unitPrice !== null && unitPrice > 0) listPrices[excelKey] = unitPrice;
      }
      excelRows.push({ code, listPrices });
    }

    let itemsUpserted = 0;
    const CHUNK = 40;
    for (let i = 0; i < excelRows.length; i += CHUNK) {
      const chunk = excelRows.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async ({ code, listPrices }) => {
          const product = byCode.get(code)!;
          for (const [excelKey, unitPrice] of Object.entries(listPrices)) {
            const priceListId = listByKey.get(excelKey);
            if (!priceListId) continue;
            await db.priceListItem.upsert({
              where: {
                priceListId_productId: {
                  priceListId,
                  productId: product.id,
                },
              },
              create: { priceListId, productId: product.id, unitPrice },
              update: { unitPrice },
            });
            itemsUpserted += 1;
          }
        }),
      );
    }

    // Base list fallback for products missing from Excel parse
    const baseId = base.id;
    let baseFallback = 0;
    for (const p of products) {
      const existing = await db.priceListItem.findUnique({
        where: {
          priceListId_productId: { priceListId: baseId, productId: p.id },
        },
      });
      if (existing) continue;
      await db.priceListItem.create({
        data: {
          priceListId: baseId,
          productId: p.id,
          unitPrice: p.basePrice,
        },
      });
      baseFallback += 1;
    }
    console.log(
      `PriceListItems: excel upserts=${itemsUpserted}, base fallback=${baseFallback}`,
    );

    // 3) Customer → list from discountPercent snapshot
    let assignedDiscount = 0;
    for (const [code, pct] of Object.entries(DISCOUNT_BY_CODE)) {
      const excelKey = PCT_TO_EXCEL_KEY[pct];
      const priceListId = excelKey ? listByKey.get(excelKey) : undefined;
      if (!priceListId) {
        console.warn(`No list for pct=${pct} code=${code}`);
        continue;
      }
      const r = await db.customer.updateMany({
        where: { code },
        data: { priceListId },
      });
      assignedDiscount += r.count;
    }
    const assignedBase = await db.customer.updateMany({
      where: { priceListId: null },
      data: { priceListId: baseId },
    });
    console.log(
      `Customers: discount-mapped=${assignedDiscount}, →base(null)=${assignedBase.count}`,
    );

    // 4) Yellow LPM unit-order flags
    const codes = [...UNIT_ORDER_PRODUCT_CODES];
    const unitFlag = await db.product.updateMany({
      where: { code: { in: codes } },
      data: { allowsUnitOrder: true },
    });
    const unitTotal = await db.product.count({
      where: { allowsUnitOrder: true },
    });
    console.log(
      `allowsUnitOrder: updated=${unitFlag.count}, total flagged=${unitTotal}/${codes.length}`,
    );

    // 5) Verify counts
    const lists = await db.priceList.count();
    const items = await db.priceListItem.count();
    const withList = await db.customer.count({
      where: { priceListId: { not: null } },
    });
    const customers = await db.customer.count();
    console.log(
      `VERIFY lists=${lists} items=${items} customers_with_list=${withList}/${customers}`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
