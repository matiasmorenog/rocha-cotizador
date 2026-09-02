import { NextRequest, NextResponse } from "next/server";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import { requireStaffApi } from "@/lib/api-auth";
import {
  getStockModuleProducts,
  searchStockModuleProducts,
} from "@/lib/stock-products-cache";

function parseModule(value: string | null): StockModuleKey | null {
  if (value === "DESPERDICIOS" || value === "CONSUMABLES" || value === "ACTIVOS") {
    return value;
  }
  return null;
}

/**
 * GET /api/admin/stock/products?module=DESPERDICIOS|CONSUMABLES|ACTIVOS&q=&take=
 *
 * Product search for admin stock recount forms (includes non-quotable kinds).
 */
export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("stockReports"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const stockModule = parseModule(req.nextUrl.searchParams.get("module"));
  if (!stockModule) {
    return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const take = Math.min(
    500,
    Math.max(1, Number(req.nextUrl.searchParams.get("take") ?? 30) || 30),
  );

  const rows = await getStockModuleProducts(stockModule);
  const matched = searchStockModuleProducts(rows, q, take);

  const products = matched.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    rubro: p.rubro,
    unitPrice: p.basePrice,
    allowsUnitOrder: p.allowsUnitOrder,
    stockKind: p.stockKind,
  }));

  return NextResponse.json(
    { products },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
