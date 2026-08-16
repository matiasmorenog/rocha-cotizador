import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import { formatDateOnlyYmd } from "@/lib/delivery-date";

/**
 * GET /api/admin/quotes?from=&to=
 * List quotes in range for the admin table (no full page reload).
 */
export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("quotes"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const { from, to } = resolveQuotesExportRange(sp.get("from"), sp.get("to"));

  if (from.getTime() >= to.getTime()) {
    return NextResponse.json(
      { error: "El rango es inválido: 'from' debe ser anterior a 'to'" },
      { status: 400 },
    );
  }

  const quotes = await db.quote.findMany({
    where: { createdAt: { gte: from, lt: to } },
    include: { customer: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    {
      quotes: quotes.map((q) => ({
        id: q.id,
        number: q.number,
        status: q.status,
        total: Number(q.total),
        createdAt: q.createdAt.toISOString(),
        deliveryDate: q.deliveryDate ? formatDateOnlyYmd(q.deliveryDate) : null,
        customer: q.customer,
      })),
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
