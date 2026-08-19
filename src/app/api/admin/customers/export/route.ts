import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  CUSTOMER_COLUMNS,
  formatBool,
  styleHeaderRow,
  xlsxResponse,
} from "@/lib/admin-excel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!(await requireStaffApi("customers"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const customers = await db.customer.findMany({
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      nameNote: true,
      email: true,
      phone: true,
      address: true,
      paymentTerms: true,
      deliveryHours: true,
      notes: true,
      active: true,
      priceList: { select: { name: true } },
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
      c.nameNote ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.address ?? "",
      c.paymentTerms ?? "",
      c.deliveryHours ?? "",
      c.notes ?? "",
      c.priceList?.name ?? "Precio base",
      formatBool(c.active),
      "",
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "clientes.xlsx");
}
