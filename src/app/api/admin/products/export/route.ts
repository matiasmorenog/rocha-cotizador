import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  PRODUCT_BASE_COLUMNS,
  formatBool,
  styleHeaderRow,
  xlsxResponse,
} from "@/lib/admin-excel";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireStaffApi("products"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [products, priceLists] = await Promise.all([
    db.product.findMany({
      orderBy: { code: "asc" },
      select: {
        code: true,
        name: true,
        rubro: true,
        basePrice: true,
        allowsUnitOrder: true,
        active: true,
        priceListItems: {
          select: { priceListId: true, unitPrice: true },
        },
      },
    }),
    db.priceList.findMany({
      select: { id: true, name: true, excelKey: true, isBase: true },
    }),
  ]);

  const orderedLists = sortPriceListsForDisplay(priceLists).filter(
    (l) => !l.isBase,
  );

  // código | nombre | rubro | precioBase | <lists…> | permitePedidoUnidad | activo
  const headers = [
    ...PRODUCT_BASE_COLUMNS.slice(0, 4),
    ...orderedLists.map((l) => l.name),
    PRODUCT_BASE_COLUMNS[4],
    PRODUCT_BASE_COLUMNS[5],
  ];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow(headers);
  styleHeaderRow(sheet.getRow(1), headers.length);

  for (const p of products) {
    const byList = new Map(
      p.priceListItems.map((i) => [i.priceListId, Number(i.unitPrice)]),
    );
    sheet.addRow([
      p.code,
      p.name,
      p.rubro ?? "",
      Number(p.basePrice),
      ...orderedLists.map((l) => {
        const v = byList.get(l.id);
        return v != null ? v : "";
      }),
      formatBool(p.allowsUnitOrder),
      formatBool(p.active),
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "productos.xlsx");
}
