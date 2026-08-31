import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { productWhereForModule } from "@/lib/stock-rubros";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import { db } from "@/lib/db";
import { foldSearchText } from "@/lib/search-fold";

function parseModule(value: string | null): StockModuleKey | null {
  if (value === "MERMAS" || value === "CONSUMABLES" || value === "ACTIVOS") {
    return value;
  }
  return null;
}

/**
 * GET /api/admin/stock/products?module=MERMAS|CONSUMABLES|ACTIVOS&q=&take=
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

  const q = foldSearchText(
    (req.nextUrl.searchParams.get("q") ?? "").trim(),
  );
  const take = Math.min(
    50,
    Math.max(1, Number(req.nextUrl.searchParams.get("take") ?? 30) || 30),
  );

  const rows = await db.product.findMany({
    where: productWhereForModule(stockModule),
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      rubro: true,
      basePrice: true,
      allowsUnitOrder: true,
      stockKind: true,
    },
  });

  const products = rows
    .filter((p) => {
      if (!q) return true;
      const hay = foldSearchText(`${p.code} ${p.name} ${p.rubro ?? ""}`);
      return hay.includes(q);
    })
    .slice(0, take)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      rubro: p.rubro,
      unitPrice: Number(p.basePrice),
      allowsUnitOrder: p.allowsUnitOrder,
      stockKind: p.stockKind,
    }));

  return NextResponse.json(
    { products },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
