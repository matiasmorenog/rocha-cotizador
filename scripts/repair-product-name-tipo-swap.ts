/**
 * Repair Product.name ↔ Product.rubro (tipo) from rocha_data.xlsx "Lista de Precios".
 *
 * Root cause: DB rows often have name/rubro swapped vs Excel (col 2 Rubro, col 3 Detalle Articulo).
 * Also fixes one-sided corruption where name = Excel rubro (e.g. "PANES") and rubro is null/wrong.
 * Sets name/rubro from Excel truth per product code. Optionally fixes denormalized QuoteItem.productName.
 *
 * Safety:
 *   Development — assertSafeDestructiveDb() (Neon development only).
 *   Production — CONFIRM_PROD_REPAIR=1 + DATABASE_URL direct on Neon main (ep-cool-mud, no -pooler).
 *
 * Usage (development):
 *   SEED_TARGET=development npx tsx scripts/repair-product-name-tipo-swap.ts
 *   SEED_TARGET=development npx tsx scripts/repair-product-name-tipo-swap.ts --apply
 *   SEED_TARGET=development npx tsx scripts/repair-product-name-tipo-swap.ts --apply --fix-quote-items
 *
 * Usage (production):
 *   CONFIRM_PROD_REPAIR=1 DATABASE_URL='postgresql://…@ep-cool-mud-….neon.tech/neondb?sslmode=require' \
 *     npx tsx scripts/repair-product-name-tipo-swap.ts
 *   … --apply [--fix-quote-items] [--revalidate]
 *
 * `--revalidate` POSTs /api/revalidate even when toFix=0 (e.g. after a prior apply without cache bust).
 */
import "dotenv/config";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import {
  LISTA_PRECIOS_COL,
  normalizeProductCode,
  parseListaPreciosProductRow,
} from "../src/lib/rocha-lista-precios-products";
import { revalidateAppCache } from "./revalidate-app-cache";

const PROD_HOST = "ep-cool-mud-a6k5vosf";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const fixQuoteItems = process.argv.includes("--fix-quote-items");
const forceRevalidate = process.argv.includes("--revalidate");

function assertProdRepairUrl(url: string | undefined) {
  if (process.env.CONFIRM_PROD_REPAIR !== "1") {
    throw new Error("Set CONFIRM_PROD_REPAIR=1 to run against Neon production");
  }
  if (!url?.trim()) throw new Error("DATABASE_URL required");
  let host: string;
  try {
    host = new URL(url.replace(/^postgresql:/i, "http:")).hostname;
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }
  if (!host.includes(PROD_HOST)) {
    throw new Error(`Refusing non-prod host: ${host}`);
  }
  if (host.includes("-pooler")) {
    throw new Error(`Use direct (non-pooler) URL, got: ${host}`);
  }
  console.log(`[prod-guard] OK — host=${host}`);
}

function excelRowForCode(
  excelByCode: Map<string, { name: string; rubro: string | null }>,
  code: string,
) {
  return (
    excelByCode.get(code) ??
    excelByCode.get(normalizeProductCode(code)) ??
    null
  );
}

type ExcelTruth = { name: string; rubro: string | null };

function classifyMismatch(
  p: { name: string; rubro: string | null },
  ex: ExcelTruth,
) {
  const dbRubro = p.rubro ?? null;
  const matchesExcel =
    p.name === ex.name && dbRubro === ex.rubro;
  if (matchesExcel) {
    return { needsRepair: false, swapped: false, rubroInNameOnly: false };
  }

  const swapped = p.name === ex.rubro && dbRubro === ex.name;
  const rubroInNameOnly =
    Boolean(ex.rubro) && p.name === ex.rubro && p.name !== ex.name;

  return {
    needsRepair: true,
    swapped,
    rubroInNameOnly: rubroInNameOnly && !swapped,
  };
}

async function main() {
  if (process.env.CONFIRM_PROD_REPAIR === "1") {
    assertProdRepairUrl(process.env.DATABASE_URL);
  } else {
    assertSafeDestructiveDb();
  }

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
  let rubroInNameOnly = 0;
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
    const ex = excelRowForCode(excelByCode, p.code);
    if (!ex) {
      notInExcel += 1;
      continue;
    }

    const { needsRepair, swapped: isSwapped, rubroInNameOnly: nameOnly } =
      classifyMismatch(p, ex);
    if (!needsRepair) {
      alreadyOk += 1;
      continue;
    }

    if (isSwapped) swapped += 1;
    else if (nameOnly) rubroInNameOnly += 1;
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

    if (toFix > 0 || forceRevalidate) {
      await revalidateAppCache();
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        fixQuoteItems: fixQuoteItems && apply,
        forceRevalidate: apply && forceRevalidate,
        excelRows: excelByCode.size,
        dbProducts: products.length,
        toFix,
        alreadyOk,
        swapped,
        rubroInNameOnly,
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
  if (apply && toFix === 0 && !forceRevalidate) {
    console.log(
      "\nDB already matches Excel. If UI still shows old names, re-run with --revalidate (needs REVALIDATE_SECRET + AUTH_URL).",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
