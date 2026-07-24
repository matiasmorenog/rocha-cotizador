/**
 * Import only UNIT_ORDER Excel products missing from DB (often basePrice 0).
 * Does not touch customers / passwords.
 *
 * Usage: SEED_TARGET=development npx tsx scripts/upsert-zero-price-products.ts
 */
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { db } from "../src/lib/db";
import {
  UNIT_ORDER_PRODUCT_CODES,
} from "../src/lib/unit-order-products";

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellText((value as { result?: ExcelJS.CellValue }).result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function cellNumber(value: ExcelJS.CellValue): number {
  if (value !== null && typeof value === "object" && "result" in value) {
    const r = (value as { result?: unknown }).result;
    if (typeof r === "number" && Number.isFinite(r)) return r;
    return cellNumber(r as ExcelJS.CellValue);
  }
  const raw = cellText(value).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  assertSafeDestructiveDb();

  const xlsxPath = path.join(process.cwd(), "prisma", "data", "rocha_data.xlsx");
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`Missing ${xlsxPath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  const sheet = workbook.getWorksheet("Lista de Precios");
  if (!sheet) throw new Error('Sheet "Lista de Precios" not found');

  const baseList = await db.priceList.findFirst({
    where: { isBase: true },
    select: { id: true },
  });
  if (!baseList) throw new Error("Precio base list missing");

  const want = new Set<string>(UNIT_ORDER_PRODUCT_CODES);
  const byCode = new Map<
    string,
    { name: string; rubro: string | null; basePrice: number }
  >();

  for (let r = 5; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codeRaw = cellText(row.getCell(1).value);
    if (!/^\d+$/.test(codeRaw)) continue;
    const code = codeRaw.padStart(4, "0");
    if (!want.has(code) && !want.has(codeRaw)) continue;

    const name = cellText(row.getCell(3).value);
    const rubro = cellText(row.getCell(2).value) || null;
    const basePrice = cellNumber(row.getCell(5).value);
    if (!name || basePrice < 0) continue;
    byCode.set(code, { name, rubro, basePrice });
  }

  let created = 0;
  let updated = 0;

  for (const code of want) {
    const row = byCode.get(code);
    if (!row) {
      console.warn(`skip ${code}: not in Excel`);
      continue;
    }

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
        // Do not overwrite a positive price with Excel $0 if already priced.
        ...(existing && Number(existing.basePrice) > 0 && row.basePrice === 0
          ? {}
          : { basePrice: row.basePrice }),
        allowsUnitOrder: true,
        active: true,
      },
    });

    const unitPrice =
      existing && Number(existing.basePrice) > 0 && row.basePrice === 0
        ? Number(existing.basePrice)
        : row.basePrice;

    await db.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: baseList.id,
          productId: product.id,
        },
      },
      create: {
        priceListId: baseList.id,
        productId: product.id,
        unitPrice,
      },
      update: { unitPrice },
    });

    if (existing) {
      updated += 1;
      console.log(`upd ${code} ${row.name}`);
    } else {
      created += 1;
      console.log(`new ${code} ${row.name} @ ${row.basePrice}`);
    }
  }

  // Remove junk $0 SKUs from a previous broad import (keep unit-order codes).
  const deleted = await db.product.deleteMany({
    where: {
      basePrice: 0,
      code: { notIn: [...UNIT_ORDER_PRODUCT_CODES] },
    },
  });
  console.log(`purged non-unit-order \$0 products: ${deleted.count}`);
  console.log(`Done. created=${created} updated=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
