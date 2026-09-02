import { NextRequest, NextResponse } from "next/server";
import type { CustomerModule } from "@prisma/client";
import { requireCustomerModuleApi } from "@/lib/customer-api-auth";
import {
  getStockModuleProducts,
  searchStockModuleProducts,
} from "@/lib/stock-products-cache";

function parseModule(value: string | null): CustomerModule | null {
  if (value === "DESPERDICIOS" || value === "CONSUMABLES" || value === "ACTIVOS") {
    return value;
  }
  return null;
}

/**
 * GET /api/customer/stock/products?module=DESPERDICIOS|CONSUMABLES|ACTIVOS&q=&take=
 */
export async function GET(req: NextRequest) {
  const customerModule = parseModule(req.nextUrl.searchParams.get("module"));
  if (!customerModule) {
    return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  }

  const ctx = await requireCustomerModuleApi(customerModule);
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const take = Math.min(
    500,
    Math.max(1, Number(req.nextUrl.searchParams.get("take") ?? 30) || 30),
  );

  const rows = await getStockModuleProducts(customerModule);
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
