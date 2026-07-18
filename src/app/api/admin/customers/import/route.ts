import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone-contact";
import { padCustomerCode, pinFromCustomerCode } from "@/lib/utils";
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
          "Cabeceras requeridas: código, nombre (ver export clientes.xlsx)",
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

    const code = padCustomerCode(codeRaw);
    if (!/^\d{3}$/.test(code)) {
      summary.errors.push({ row: r, message: `Código inválido: ${codeRaw}` });
      continue;
    }

    const discountRaw = cellNumber(
      getCellByHeader(row, headers, "descuentoPercent"),
    );
    const discountPercent =
      discountRaw === null ? 0 : Math.min(100, Math.max(0, discountRaw));

    const phoneRaw = emptyToNull(
      cellText(getCellByHeader(row, headers, "teléfono")),
    );
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    const email = emptyToNull(cellText(getCellByHeader(row, headers, "email")));
    const address = emptyToNull(
      cellText(getCellByHeader(row, headers, "dirección")),
    );
    const paymentTerms = emptyToNull(
      cellText(getCellByHeader(row, headers, "condicionesPago")),
    );
    const deliveryHours = emptyToNull(
      cellText(getCellByHeader(row, headers, "horarioEntrega")),
    );
    const notes = emptyToNull(cellText(getCellByHeader(row, headers, "notas")));
    const active = parseBool(getCellByHeader(row, headers, "activo"), true);
    const resetPin = parseBool(
      getCellByHeader(row, headers, "resetearPin"),
      false,
    );

    try {
      const existing = await db.customer.findUnique({ where: { code } });

      if (existing) {
        const data: {
          name: string;
          discountPercent: number;
          address: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          paymentTerms: string | null;
          deliveryHours: string | null;
          active: boolean;
          passwordHash?: string;
          mustChangePassword?: boolean;
        } = {
          name,
          discountPercent,
          address,
          phone,
          email,
          notes,
          paymentTerms,
          deliveryHours,
          active,
        };

        if (resetPin) {
          const pin = pinFromCustomerCode(code);
          data.passwordHash = await bcrypt.hash(pin, 10);
          data.mustChangePassword = true;
        }

        await db.customer.update({ where: { code }, data });
        summary.updated += 1;
      } else {
        const pin = pinFromCustomerCode(code);
        const passwordHash = await bcrypt.hash(pin, 10);
        await db.customer.create({
          data: {
            code,
            name,
            passwordHash,
            mustChangePassword: true,
            discountPercent,
            address,
            phone,
            email,
            notes,
            paymentTerms,
            deliveryHours,
            active,
          },
        });
        summary.created += 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al guardar";
      summary.errors.push({ row: r, message });
    }
  }

  return NextResponse.json(summary);
}
