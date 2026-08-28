/**
 * Repair Product.name ↔ Product.rubro (tipo) from rocha_data.xlsx "Lista de Precios".
 *
 * Root cause: DB rows often have name/rubro swapped vs Excel (col 2 Rubro, col 3 Detalle Articulo).
 * Sets name/rubro from Excel truth per product code. Optionally fixes denormalized QuoteItem.productName.
 *
 * Safety (fail closed — never production / Neon branch main):
 *   assertSafeDestructiveDb() — same guards as dev-wipe-customers.
 *
 * Usage:
 *   SEED_TARGET=development npx tsx scripts/repair-product-name-tipo-swap.ts
 *   SEED_TARGET=development npx tsx scripts/repair-product-name-tipo-swap.ts --apply
 *   SEED_TARGET=development npx tsx scripts/repair-product-name-tipo-swap.ts --apply --fix-quote-items
 */
import "dotenv/config";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import {
  LISTA_PRECIOS_COL,
  parseListaPreciosProductRow,
} from "../src/lib/rocha-lista-precios-products";
import { revalidateAppCache } from "./revalidate-app-cache";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const fixQuoteItems = process.argv.includes("--fix-quote-items");

async function main() {
  assertSafeDestructiveDb();

  const xlsxPath = path.join(__dirname, "../prisma/data/rocha_data.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  const sheet = workbook.getWorksheet("Lista de Precios");
  if (!sheet) throw new Error('Missing sheet "Lista de Precios"');

  const excelByCode = new Map<
    string,
    { name: string; rubro: string | null }
  >();
  for (
    let r = LISTA_PRECIOS_COL.DATA_START_ROW;
    r <= sheet.rowCount;
    r++
  ) {
    const parsed = parseListaPreciosProductRow(sheet.getRow(r));
    if (!parsed) continue;
    excelByCode.set(parsed.code, {
      name: parsed.name,
      rubro: parsed.rubro,
    });
  }

  const products = await db.product.findMany({
    select: { id: true, code: true, name: true, rubro: true },
    orderBy: { code: "asc" },
  });

  let toFix = 0;
  let alreadyOk = 0;
  let swapped = 0;
  let notInExcel = 0;
  let otherMismatch = 0;
  let quoteItemsToFix = 0;
  let quoteItemsFixed = 0;

  type PendingFix = {
    id: string;
    code: string;
    oldName: string;
    newName: string;
    oldRubro: string | null;
    newRubro: string | null;
  };
  const pending: PendingFix[] = [];

  for (const p of products) {
    const ex = excelByCode.get(p.code);
    if (!ex) {
      notInExcel += 1;
      continue;
    }

    const ok =
      p.name === ex.name && (p.rubro ?? null) === ex.rubro;
    if (ok) {
      alreadyOk += 1;
      continue;
    }

    const isSwapped =
      p.name === ex.rubro && (p.rubro ?? null) === ex.name;
    if (isSwapped) swapped += 1;
    else otherMismatch += 1;

    pending.push({
      id: p.id,
      code: p.code,
      oldName: p.name,
      newName: ex.name,
      oldRubro: p.rubro,
      newRubro: ex.rubro,
    });
    toFix += 1;

    if (fixQuoteItems && !apply) {
      const count = await db.quoteItem.count({
        where: {
          productId: p.id,
          productName: p.name,
        },
      });
      quoteItemsToFix += count;
    }
  }

  if (!apply) {
    const preview = pending.slice(0, 8);
    for (const row of preview) {
      console.log(
        `[dry-run] ${row.code}: name "${row.oldName}" / rubro "${row.oldRubro ?? ""}" → name "${row.newName}" / rubro "${row.newRubro ?? ""}"`,
      );
    }
    if (pending.length > preview.length) {
      console.log(`… and ${pending.length - preview.length} more`);
    }
  } else {
    for (const row of pending) {
      await db.product.update({
        where: { id: row.id },
        data: { name: row.newName, rubro: row.newRubro },
      });

      if (fixQuoteItems) {
        const updated = await db.quoteItem.updateMany({
          where: {
            productId: row.id,
            productName: row.oldName,
          },
          data: { productName: row.newName },
        });
        quoteItemsFixed += updated.count;
      }
    }

    if (toFix > 0) {
      await revalidateAppCache();
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        fixQuoteItems: fixQuoteItems && apply,
        excelRows: excelByCode.size,
        dbProducts: products.length,
        toFix,
        alreadyOk,
        swapped,
        otherMismatch,
        notInExcel,
        quoteItemsFixed: apply && fixQuoteItems ? quoteItemsFixed : undefined,
        quoteItemsWouldFix:
          !apply && fixQuoteItems ? quoteItemsToFix : undefined,
      },
      null,
      2,
    ),
  );

  if (!apply && toFix > 0) {
    console.log(
      "\nRe-run with --apply to write changes. Add --fix-quote-items to update QuoteItem.productName snapshots.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
