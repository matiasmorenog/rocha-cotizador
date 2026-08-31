import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { getStockSummary } from "@/lib/admin-stock-summary";
import {
  parseStockSummaryTab,
  resolveStockDateRange,
} from "@/lib/admin-stock-summary-shared";

/**
 * GET /api/admin/stock/summary?tab=elaborados|consumibles|activos&customerId=&from=&to=
 *
 * Server-side stock aggregates (quantities and base-price cost) for summary cards, product table, and chart.
 */
export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("stockReports"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const tab = parseStockSummaryTab(params.get("tab"));
  if (!tab) {
    return NextResponse.json({ error: "Tab inválido" }, { status: 400 });
  }

  const { from, to } = resolveStockDateRange(
    params.get("from") ?? undefined,
    params.get("to") ?? undefined,
  );
  const customerId = (params.get("customerId") ?? "").trim() || undefined;

  try {
    const summary = await getStockSummary({ tab, from, to, customerId });
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al calcular resumen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
