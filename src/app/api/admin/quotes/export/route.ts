import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import {
  buildQuotesExportPdf,
  pdfResponse,
} from "@/lib/quotes-export-pdf";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * GET /api/admin/quotes/export?from=&to=
 *
 * `from` / `to`: `YYYY-MM-DDTHH:mm` interpreted as America/Argentina/Buenos_Aires
 * wall time, or any ISO-8601 string. Default: yesterday 16:00 → today 16:00 (AR).
 * Filter: createdAt >= from AND createdAt < to (half-open).
 * Returns a multi-remito PDF (`cotizaciones.pdf`).
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
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

  const buffer = await buildQuotesExportPdf({ quotes, from, to });
  return pdfResponse(buffer, "cotizaciones.pdf");
}
