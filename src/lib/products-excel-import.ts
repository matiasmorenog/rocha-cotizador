import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { invalidateAfterProductMutation } from "@/lib/cache-tags";
import { syncBaseListItemForProduct } from "@/lib/price-list-resolve";
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
import {
  PRODUCT_CODE_HEADER_ALIASES,
  PRODUCT_NAME_HEADER_ALIASES,
  PRODUCT_RUBRO_HEADER_ALIASES,
  resolveProductHeaderColumn,
} from "@/lib/rocha-lista-precios-products";
import type { ProductStockKind } from "@prisma/client";

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

export async function executeProductsImport(
  ctx: ProductsImportContext,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let r = 2; r <= ctx.sheet.rowCount; r++) {
    const row = ctx.sheet.getRow(r);
    const codeRaw = cellText(getCellByHeader(row, ctx.headers, "código"));
    const name = cellText(getCellByHeader(row, ctx.headers, "nombre"));

    if (!codeRaw && !name) {
      summary.skipped += 1;
      continue;
    }

    const validation = validateProductsRow(row, r, ctx);
    if (validation.skip) {
      summary.skipped += 1;
      continue;
    }
    if (validation.error) {
      summary.errors.push({ row: r, message: validation.error });
      continue;
    }

    const code = codeRaw.trim();
    const rubro = emptyToNull(cellText(getCellByHeader(row, ctx.headers, "rubro")));
    const priceRaw = cellNumber(getCellByHeader(row, ctx.headers, "precioBase"))!;
    const available = parseBool(
      getCellByHeader(row, ctx.headers, "habilitado"),
      true,
    );
    const stockKindRaw = parseStockKindFromCell(
      getCellByHeader(row, ctx.headers, "tipoStock"),
    );
    if (stockKindRaw === "invalid") {
      summary.errors.push({
        row: r,
        message: "tipoStock inválido (ELABORADO, CONSUMIBLE, ACTIVO_LOCAL o vacío)",
      });
      continue;
    }
    const allowsUnitOrder = parseBool(
      getCellByHeader(row, ctx.headers, "permitePedidoUnidad"),
      false,
    );

    try {
      const existing = await db.product.findUnique({ where: { code } });
      const data = {
        code,
        name,
        rubro,
        basePrice: priceRaw,
        allowsUnitOrder,
        available,
        stockKind: stockKindRaw ?? inferStockKindFromRubro(rubro),
      };

      const product = existing
        ? await db.product.update({ where: { code }, data })
        : await db.product.create({ data });

      await syncBaseListItemForProduct(product.id, product.basePrice);

      if (existing) summary.updated += 1;
      else summary.created += 1;

      for (const col of ctx.listColumns) {
        const raw = getCellByHeader(row, ctx.headers, col.header);
        const text = cellText(raw).trim();
        if (!text) {
          await db.priceListItem.deleteMany({
            where: {
              priceListId: col.priceListId,
              productId: product.id,
            },
          });
          continue;
        }
        const unitPrice = cellNumber(raw)!;
        await db.priceListItem.upsert({
          where: {
            priceListId_productId: {
              priceListId: col.priceListId,
              productId: product.id,
            },
          },
          create: {
            priceListId: col.priceListId,
            productId: product.id,
            unitPrice,
          },
          update: { unitPrice },
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al guardar";
      summary.errors.push({ row: r, message });
    }
  }

  if (summary.created > 0 || summary.updated > 0) {
    invalidateAfterProductMutation();
  }

  return summary;
}
