import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchActiveProductsBase } from "@/lib/products-cache";
import { resolveUnitPricesForList } from "@/lib/price-list-resolve";

/** Fallback search API — quote UI prefers local catalog filter. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ products: [] });
  }

  const products = await searchActiveProductsBase(q, 30);

  let priceListId: string | null = null;

  if (session.user.role === "CUSTOMER" && session.user.customerId) {
    const customer = await db.customer.findUnique({
      where: { id: session.user.customerId },
      select: { priceListId: true },
    });
    priceListId = customer?.priceListId ?? null;
  } else if (session.user.role === "ADMIN") {
    const customerId = (req.nextUrl.searchParams.get("customerId") ?? "").trim();
    if (!customerId) {
      return NextResponse.json(
        { error: "customerId requerido para precios de cliente" },
        { status: 400 },
      );
    }
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { priceListId: true, active: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    priceListId = customer.priceListId;
  }

  const unitPrices = await resolveUnitPricesForList(
    products.map((p) => ({
      id: p.id,
      code: p.code,
      basePrice: p.basePrice,
    })),
    priceListId,
  );

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      rubro: p.rubro,
      unitPrice: unitPrices[p.code] ?? p.basePrice,
      allowsUnitOrder: p.allowsUnitOrder,
    })),
  });
}
