import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CUSTOMER_COLUMNS,
  formatBool,
  styleHeaderRow,
  xlsxResponse,
} from "@/lib/admin-excel";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const customers = await db.customer.findMany({
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      paymentTerms: true,
      deliveryHours: true,
      notes: true,
      discountPercent: true,
      active: true,
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Clientes");
  sheet.addRow([...CUSTOMER_COLUMNS]);
  styleHeaderRow(sheet.getRow(1), CUSTOMER_COLUMNS.length);

  for (const c of customers) {
    sheet.addRow([
      c.code,
      c.name,
      c.email ?? "",
      c.phone ?? "",
      c.address ?? "",
      c.paymentTerms ?? "",
      c.deliveryHours ?? "",
      c.notes ?? "",
      Number(c.discountPercent),
      formatBool(c.active),
      "", // resetearPin — leave blank on export (round-trip safe)
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "clientes.xlsx");
}
