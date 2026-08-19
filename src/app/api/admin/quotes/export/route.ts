import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import {
  buildQuotesExportPdf,
  pdfResponse,
} from "@/lib/quotes-export-pdf";

export const runtime = "nodejs";
/** Multi-remito PDF over date range — Neon cold + pdfkit. */
export const maxDuration = 60;

/**
 * GET /api/admin/quotes/export?from=&to=
 *
 * `from` / `to`: `YYYY-MM-DDTHH:mm` interpreted as America/Argentina/Buenos_Aires
 * wall time, or any ISO-8601 string. Default: yesterday 16:00 → now (AR).
 * Filter: createdAt >= from AND createdAt < to (half-open).
 * Returns a multi-remito PDF (`cotizaciones.pdf`).
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
    where: {
      createdAt: { gte: from, lt: to },
    },
    include: {
      customer: { select: { code: true, name: true } },
      items: { orderBy: { productCode: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const productIds = [
    ...new Set(
      quotes.flatMap((q) =>
        q.items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, allowsUnitOrder: true },
        })
      : [];
  const allowsUnitOrderByProductId = new Map(
    products.map((p) => [p.id, p.allowsUnitOrder]),
  );

  const quotesForPdf = quotes.map((quote) => ({
    ...quote,
    items: quote.items.map((item) => ({
      ...item,
      allowsUnitOrder: item.productId
        ? (allowsUnitOrderByProductId.get(item.productId) ?? false)
        : false,
    })),
  }));

  const buffer = await buildQuotesExportPdf({ quotes: quotesForPdf, from, to });
  return pdfResponse(buffer, "cotizaciones.pdf");
}
