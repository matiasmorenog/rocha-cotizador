import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import {
  serializeStockItemReport,
  stockItemReportSelect,
} from "@/lib/stock-item-serialize";

export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("stockReports"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const customerId = (req.nextUrl.searchParams.get("customerId") ?? "").trim();

  const from = fromParam ? parseDateOnlyYmd(fromParam) : null;
  const to = toParam ? parseDateOnlyYmd(toParam) : null;

  const counts = await db.consumableCount.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(from || to
        ? {
            entryDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      customer: { select: { code: true, name: true } },
      lines: {
        include: {
          stockItem: {
            select: stockItemReportSelect,
          },
        },
      },
    },
  });

  return NextResponse.json({
    entries: counts.map((e) => ({
      id: e.id,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      notes: e.notes,
      submittedBy: e.submittedBy,
      customer: e.customer,
      lines: e.lines.map((l) => ({
        stockItemId: l.stockItemId,
        qty: Number(l.qty),
        stockItem: serializeStockItemReport(l.stockItem),
      })),
    })),
  });
}
