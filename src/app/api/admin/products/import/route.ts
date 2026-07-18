import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
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

    try {
      const existing = await db.product.findUnique({ where: { code } });
      const data = {
        code,
        name,
        rubro,
        basePrice: priceRaw,
        active,
      };

      if (existing) {
        await db.product.update({ where: { code }, data });
        summary.updated += 1;
      } else {
        await db.product.create({ data });
        summary.created += 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al guardar";
      summary.errors.push({ row: r, message });
    }
  }

  return NextResponse.json(summary);
}
