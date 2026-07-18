import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { priceForCustomer } from "@/lib/pricing";
import { searchActiveProductsBase } from "@/lib/products-cache";

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

  // Catalog from shared cache (basePrice only); discount applied below per request.
  const products = await searchActiveProductsBase(q, 30);

  let discountPercent = 0;

  if (session.user.role === "CUSTOMER" && session.user.customerId) {
    const customer = await db.customer.findUnique({
      where: { id: session.user.customerId },
      select: { discountPercent: true },
    });
    discountPercent = Number(customer?.discountPercent ?? 0);
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
      select: { discountPercent: true, active: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    discountPercent = Number(customer.discountPercent ?? 0);
  }

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      rubro: p.rubro,
      unitPrice: Number(priceForCustomer(p.basePrice, discountPercent)),
    })),
  });
}
