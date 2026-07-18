import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PRODUCT_COLUMNS,
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

  const products = await db.product.findMany({
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      rubro: true,
      basePrice: true,
      active: true,
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow([...PRODUCT_COLUMNS]);
  styleHeaderRow(sheet.getRow(1), PRODUCT_COLUMNS.length);

  for (const p of products) {
    sheet.addRow([
      p.code,
      p.name,
      p.rubro ?? "",
      Number(p.basePrice),
      formatBool(p.active),
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "productos.xlsx");
}
