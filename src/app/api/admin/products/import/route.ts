import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterProductMutation } from "@/lib/cache-tags";
import { syncBaseListItemForProduct } from "@/lib/price-list-resolve";
import {
  listDistinctProductRubros,
  maybeInvalidateProductRubrosCache,
} from "@/lib/stock-rubros";
import {
  cellNumber,
  cellText,
  emptyToNull,
  getCellByHeader,
  headerIndexMap,
  parseBool,
  workbookFromBuffer,
  type ImportSummary,
} from "@/lib/admin-excel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await requireStaffApi("products"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Falta archivo (campo file)" },
      { status: 400 },
    );
  }

  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  let workbook;
  try {
    workbook = await workbookFromBuffer(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el Excel" },
      { status: 400 },
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return NextResponse.json(
      { error: "Hoja vacía o sin datos" },
      { status: 400 },
    );
  }

  const headers = headerIndexMap(sheet.getRow(1));
  if (!headers.has("código") || !headers.has("nombre")) {
    return NextResponse.json(
      {
        error:
          "Cabeceras requeridas: código, nombre (ver export productos.xlsx)",
      },
      { status: 400 },
    );
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

  /** Columns that are discount price lists (not base product fields / isBase list). */
  const listColumns: Array<{ header: string; priceListId: string }> = [];
  for (const [header] of headers) {
    if (
      [
        "código",
        "nombre",
        "rubro",
        "preciobase",
        "permitipedidounidad",
        "activo",
      ].includes(header)
    ) {
      continue;
    }
    const id = listByHeader.get(header);
    if (id && !baseListIds.has(id)) {
      listColumns.push({ header, priceListId: id });
    }
  }

  const knownRubros = await listDistinctProductRubros();
  const importedRubros = new Set<string>();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codeRaw = cellText(getCellByHeader(row, headers, "código"));
    const name = cellText(getCellByHeader(row, headers, "nombre"));

    if (!codeRaw && !name) {
      summary.skipped += 1;
      continue;
    }

    if (!codeRaw) {
      summary.errors.push({ row: r, message: "Falta código" });
      continue;
    }
    if (!name) {
      summary.errors.push({ row: r, message: "Falta nombre" });
      continue;
    }

    const code = codeRaw.trim();
    const rubro = emptyToNull(cellText(getCellByHeader(row, headers, "rubro")));
    const priceRaw = cellNumber(getCellByHeader(row, headers, "precioBase"));
    if (priceRaw === null || priceRaw < 0) {
      summary.errors.push({
        row: r,
        message: "precioBase inválido o faltante",
      });
      continue;
    }
    const active = parseBool(getCellByHeader(row, headers, "activo"), true);
    const allowsUnitOrder = parseBool(
      getCellByHeader(row, headers, "permitePedidoUnidad"),
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
        active,
      };

      const product = existing
        ? await db.product.update({ where: { code }, data })
        : await db.product.create({ data });

      if (rubro) importedRubros.add(rubro);

      await syncBaseListItemForProduct(product.id, product.basePrice);

      if (existing) summary.updated += 1;
      else summary.created += 1;

      for (const col of listColumns) {
        const raw = getCellByHeader(row, headers, col.header);
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
        const unitPrice = cellNumber(raw);
        if (unitPrice === null || unitPrice < 0) {
          summary.errors.push({
            row: r,
            message: `Precio inválido en columna ${col.header}`,
          });
          continue;
        }
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
    for (const r of importedRubros) {
      await maybeInvalidateProductRubrosCache(r, knownRubros);
    }
  }

  return NextResponse.json(summary);
}
