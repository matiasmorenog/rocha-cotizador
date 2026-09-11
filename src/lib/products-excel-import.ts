import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { Prisma, type ProductStockKind } from "@prisma/client";
import { db } from "@/lib/db";
import { invalidateAfterProductMutation } from "@/lib/cache-tags";
import { getBasePriceList } from "@/lib/price-list-resolve";
import {
  cellNumber,
  cellText,
  duplicateCodeWarnings,
  emptyToNull,
  getCellByHeader,
  headerIndexMap,
  parseBool,
  workbookFromBuffer,
  type ImportSummary,
  type ImportValidationResult,
} from "@/lib/admin-excel";
import { inferStockKindFromRubro } from "@/lib/stock-rubros-shared";
import { normalizeAllowsUnitOrder } from "@/lib/stock-product-kind-shared";
import {
  PRODUCT_CODE_HEADER_ALIASES,
  PRODUCT_NAME_HEADER_ALIASES,
  PRODUCT_RUBRO_HEADER_ALIASES,
  resolveProductHeaderColumn,
} from "@/lib/rocha-lista-precios-products";

function parseStockKindFromCell(
  raw: ExcelJS.CellValue,
): ProductStockKind | null | "invalid" {
  const t = cellText(raw).trim().toUpperCase();
  if (!t) return null;
  if (
    [
      "DESPERDICIO",
      "MERMA",
      "DESPERDICIOS",
      "BAJAS",
      "BAJAS DEL DIA",
      "ELABORADOS",
      "ELABORADO",
    ].includes(t)
  ) {
    return "DESPERDICIO";
  }
  if (["CONSUMABLE", "CONSUMIBLE", "CONSUMIBLES"].includes(t)) {
    return "CONSUMABLE";
  }
  if (
    ["LOCAL_ASSET", "ACTIVO", "ACTIVOS", "ACTIVO_LOCAL", "ACTIVO LOCAL"].includes(
      t,
    )
  ) {
    return "LOCAL_ASSET";
  }
  return "invalid";
}

export type ProductsImportContext = {
  sheet: ExcelJS.Worksheet;
  headers: Map<string, number>;
  listColumns: Array<{ header: string; priceListId: string }>;
};

type LoadError = { ok: false; error: string; status: number };
type LoadOk = { ok: true; ctx: ProductsImportContext };

export async function loadProductsImportFromBuffer(
  buf: ArrayBuffer,
): Promise<LoadOk | LoadError> {
  let workbook: ExcelJS.Workbook;
  try {
    workbook = await workbookFromBuffer(buf);
  } catch {
    return { ok: false, error: "No se pudo leer el Excel", status: 400 };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { ok: false, error: "Hoja vacía o sin datos", status: 400 };
  }

  const rawHeaders = headerIndexMap(sheet.getRow(1));
  const headers = new Map(rawHeaders);
  const codeCol = resolveProductHeaderColumn(
    rawHeaders,
    PRODUCT_CODE_HEADER_ALIASES,
  );
  const nameCol = resolveProductHeaderColumn(
    rawHeaders,
    PRODUCT_NAME_HEADER_ALIASES,
  );
  const rubroCol = resolveProductHeaderColumn(
    rawHeaders,
    PRODUCT_RUBRO_HEADER_ALIASES,
  );
  if (codeCol) headers.set("código", codeCol);
  if (nameCol) headers.set("nombre", nameCol);
  if (rubroCol) headers.set("rubro", rubroCol);
  if (headers.has("disponible") && !headers.has("habilitado")) {
    headers.set("habilitado", headers.get("disponible")!);
  }
  if (headers.has("activo") && !headers.has("habilitado")) {
    headers.set("habilitado", headers.get("activo")!);
  }

  if (!headers.has("código") || !headers.has("nombre")) {
    return {
      ok: false,
      error:
        "Cabeceras requeridas: código, nombre (o Detalle Articulo — ver export productos.xlsx)",
      status: 400,
    };
  }
  if (nameCol && rubroCol && nameCol === rubroCol) {
    return {
      ok: false,
      error: "Las columnas nombre y rubro/tipo no pueden ser la misma",
      status: 400,
    };
  }

  const priceLists = await db.priceList.findMany({
    select: { id: true, name: true, isBase: true },
  });
  const listByHeader = new Map(
    priceLists.map((l) => [l.name.trim().toLowerCase(), l.id]),
  );
  const baseListIds = new Set(
    priceLists.filter((l) => l.isBase).map((l) => l.id),
  );

  const listColumns: ProductsImportContext["listColumns"] = [];
  for (const [header] of headers) {
    if (
      [
        "código",
        "nombre",
        "rubro",
        "preciobase",
        "permitipedidounidad",
        "activo",
        "disponible",
        "habilitado",
        "tipostock",
      ].includes(header)
    ) {
      continue;
    }
    const id = listByHeader.get(header);
    if (id && !baseListIds.has(id)) {
      listColumns.push({ header, priceListId: id });
    }
  }

  return { ok: true, ctx: { sheet, headers, listColumns } };
}

function validateProductsRow(
  row: ExcelJS.Row,
  rowNum: number,
  ctx: ProductsImportContext,
): { skip: boolean; error?: string } {
  const codeRaw = cellText(getCellByHeader(row, ctx.headers, "código"));
  const name = cellText(getCellByHeader(row, ctx.headers, "nombre"));

  if (!codeRaw && !name) {
    return { skip: true };
  }

  if (!codeRaw) {
    return { skip: false, error: "Falta código" };
  }
  if (!name) {
    return { skip: false, error: "Falta nombre" };
  }

  const priceRaw = cellNumber(getCellByHeader(row, ctx.headers, "precioBase"));
  if (priceRaw === null || priceRaw < 0) {
    return { skip: false, error: "precioBase inválido o faltante" };
  }

  for (const col of ctx.listColumns) {
    const raw = getCellByHeader(row, ctx.headers, col.header);
    const text = cellText(raw).trim();
    if (!text) continue;
    const unitPrice = cellNumber(raw);
    if (unitPrice === null || unitPrice < 0) {
      return {
        skip: false,
        error: `Precio inválido en columna ${col.header}`,
      };
    }
  }

  return { skip: false };
}

export function validateProductsImport(
  ctx: ProductsImportContext,
): ImportValidationResult {
  const result: ImportValidationResult = {
    ok: true,
    rowCount: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  const codeRows: Array<{ row: number; code: string }> = [];

  for (let r = 2; r <= ctx.sheet.rowCount; r++) {
    const row = ctx.sheet.getRow(r);
    const codeRaw = cellText(getCellByHeader(row, ctx.headers, "código"));
    const name = cellText(getCellByHeader(row, ctx.headers, "nombre"));

    if (!codeRaw && !name) {
      result.skipped += 1;
      continue;
    }

    if (codeRaw.trim()) {
      codeRows.push({ row: r, code: codeRaw.trim() });
    }

    const outcome = validateProductsRow(row, r, ctx);
    if (outcome.skip) {
      continue;
    }
    if (outcome.error) {
      result.errors.push({ row: r, message: outcome.error });
      continue;
    }
    result.rowCount += 1;
  }

  result.warnings = duplicateCodeWarnings(codeRows);
  result.ok = result.errors.length === 0;
  return result;
}

type PreparedProductRow = {
  row: number;
  code: string;
  name: string;
  rubro: string | null;
  basePrice: number;
  allowsUnitOrder: boolean;
  available: boolean;
  stockKind: ProductStockKind;
  /** null unitPrice → delete that list item */
  listPrices: Array<{ priceListId: string; unitPrice: number | null }>;
};

function prepareProductRows(ctx: ProductsImportContext): {
  rows: PreparedProductRow[];
  skipped: number;
  errors: ImportSummary["errors"];
} {
  const byCode = new Map<string, PreparedProductRow>();
  const errors: ImportSummary["errors"] = [];
  let skipped = 0;

  for (let r = 2; r <= ctx.sheet.rowCount; r++) {
    const row = ctx.sheet.getRow(r);
    const codeRaw = cellText(getCellByHeader(row, ctx.headers, "código"));
    const name = cellText(getCellByHeader(row, ctx.headers, "nombre"));

    if (!codeRaw && !name) {
      skipped += 1;
      continue;
    }

    const validation = validateProductsRow(row, r, ctx);
    if (validation.skip) {
      skipped += 1;
      continue;
    }
    if (validation.error) {
      errors.push({ row: r, message: validation.error });
      continue;
    }

    const code = codeRaw.trim();
    const rubro = emptyToNull(
      cellText(getCellByHeader(row, ctx.headers, "rubro")),
    );
    const priceRaw = cellNumber(
      getCellByHeader(row, ctx.headers, "precioBase"),
    )!;
    const available = parseBool(
      getCellByHeader(row, ctx.headers, "habilitado"),
      true,
    );
    const stockKindRaw = parseStockKindFromCell(
      getCellByHeader(row, ctx.headers, "tipoStock"),
    );
    if (stockKindRaw === "invalid") {
      errors.push({
        row: r,
        message:
          "tipoStock inválido (ELABORADO, CONSUMIBLE, ACTIVO_LOCAL o vacío)",
      });
      continue;
    }
    const stockKind = stockKindRaw ?? inferStockKindFromRubro(rubro);
    const allowsUnitOrder = normalizeAllowsUnitOrder(
      stockKind,
      parseBool(
        getCellByHeader(row, ctx.headers, "permitePedidoUnidad"),
        false,
      ),
    );

    const listPrices = ctx.listColumns.map((col) => {
      const raw = getCellByHeader(row, ctx.headers, col.header);
      const text = cellText(raw).trim();
      return {
        priceListId: col.priceListId,
        unitPrice: text ? cellNumber(raw) : null,
      };
    });

    // Last duplicate code wins (same as sequential upsert).
    byCode.set(code, {
      row: r,
      code,
      name,
      rubro,
      basePrice: priceRaw,
      allowsUnitOrder,
      available,
      stockKind,
      listPrices,
    });
  }

  return { rows: [...byCode.values()], skipped, errors };
}

/**
 * Bulk upsert products + price list items (few DB round-trips).
 * Replaces per-row find/update/upsert that made ~500-row imports take minutes.
 */
export async function executeProductsImport(
  ctx: ProductsImportContext,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const prepared = prepareProductRows(ctx);
  summary.skipped = prepared.skipped;
  summary.errors.push(...prepared.errors);

  if (prepared.rows.length === 0) {
    return summary;
  }

  try {
    const codes = prepared.rows.map((r) => r.code);
    const [existing, baseList] = await Promise.all([
      db.product.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true },
      }),
      getBasePriceList(),
    ]);
    const existingByCode = new Map(existing.map((p) => [p.code, p.id]));

    const productValues = prepared.rows.map((p) => {
      const id = existingByCode.get(p.code) ?? randomUUID();
      return Prisma.sql`(
        ${id},
        ${p.code},
        ${p.name},
        ${p.rubro},
        ${p.basePrice},
        ${p.allowsUnitOrder},
        ${p.available},
        CAST(${p.stockKind} AS "ProductStockKind"),
        NOW(),
        NOW()
      )`;
    });

    const upserted = await db.$queryRaw<Array<{ id: string; code: string }>>`
      INSERT INTO "Product" (
        id, code, name, rubro, "basePrice", "allowsUnitOrder", available, "stockKind", "createdAt", "updatedAt"
      )
      VALUES ${Prisma.join(productValues)}
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        rubro = EXCLUDED.rubro,
        "basePrice" = EXCLUDED."basePrice",
        "allowsUnitOrder" = EXCLUDED."allowsUnitOrder",
        available = EXCLUDED.available,
        "stockKind" = EXCLUDED."stockKind",
        "updatedAt" = NOW()
      RETURNING id, code
    `;

    const idByCode = new Map(upserted.map((p) => [p.code, p.id]));
    for (const row of prepared.rows) {
      if (existingByCode.has(row.code)) summary.updated += 1;
      else summary.created += 1;
    }

    const upsertItems: Prisma.Sql[] = [];
    const deletePairs: Prisma.Sql[] = [];

    for (const row of prepared.rows) {
      const productId = idByCode.get(row.code);
      if (!productId) {
        summary.errors.push({
          row: row.row,
          message: "No se pudo resolver el producto tras el upsert",
        });
        continue;
      }

      if (baseList) {
        upsertItems.push(
          Prisma.sql`(
            ${randomUUID()},
            ${baseList.id},
            ${productId},
            ${row.basePrice},
            NOW()
          )`,
        );
      }

      for (const lp of row.listPrices) {
        if (lp.unitPrice === null) {
          deletePairs.push(Prisma.sql`(${lp.priceListId}, ${productId})`);
          continue;
        }
        upsertItems.push(
          Prisma.sql`(
            ${randomUUID()},
            ${lp.priceListId},
            ${productId},
            ${lp.unitPrice},
            NOW()
          )`,
        );
      }
    }

    if (deletePairs.length > 0) {
      await db.$executeRaw`
        DELETE FROM "PriceListItem" AS pli
        USING (VALUES ${Prisma.join(deletePairs)}) AS v("priceListId", "productId")
        WHERE pli."priceListId" = v."priceListId"
          AND pli."productId" = v."productId"
      `;
    }

    if (upsertItems.length > 0) {
      await db.$executeRaw`
        INSERT INTO "PriceListItem" (
          id, "priceListId", "productId", "unitPrice", "updatedAt"
        )
        VALUES ${Prisma.join(upsertItems)}
        ON CONFLICT ("priceListId", "productId") DO UPDATE SET
          "unitPrice" = EXCLUDED."unitPrice",
          "updatedAt" = NOW()
      `;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al guardar";
    summary.errors.push({ row: 0, message });
    return summary;
  }

  if (summary.created > 0 || summary.updated > 0) {
    invalidateAfterProductMutation();
  }

  return summary;
}
