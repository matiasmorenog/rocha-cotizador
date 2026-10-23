import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import { getAdminQuotesProductSales } from "@/lib/admin-quotes-by-product";

export const runtime = "nodejs";
/** Aggregate lines over date range — Neon cold. */
export const maxDuration = 60;

/**
 * GET /api/admin/quotes/by-product?from=&to=&q=
 * Same range + search as Cotizaciones list / PDF export; returns kg vs units per SKU.
 */
export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("quotes"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const { from, to } = resolveQuotesExportRange(sp.get("from"), sp.get("to"));
  const q = (sp.get("q") ?? "").trim();

  if (from.getTime() >= to.getTime()) {
    return NextResponse.json(
      { error: "El rango es inválido: 'from' debe ser anterior a 'to'" },
      { status: 400 },
    );
  }

  const result = await getAdminQuotesProductSales(from, to, q);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
