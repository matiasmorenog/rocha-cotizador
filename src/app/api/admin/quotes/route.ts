import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import { getAdminCotizacionesQuotes } from "@/lib/admin-cotizaciones-data";

/**
 * GET /api/admin/quotes?from=&to=
 * List quotes in range for the admin table (no full page reload).
 */
export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("quotes"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const { from, to } = resolveQuotesExportRange(fromParam, toParam);

  if (from.getTime() >= to.getTime()) {
    return NextResponse.json(
      { error: "El rango es inválido: 'from' debe ser anterior a 'to'" },
      { status: 400 },
    );
  }

  const quotes = await getAdminCotizacionesQuotes(from, to, toParam);

  return NextResponse.json(
    { quotes },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
