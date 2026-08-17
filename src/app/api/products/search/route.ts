import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchActiveProductsBase } from "@/lib/products-cache";
import {
  getCachedCustomerPricingContext,
  resolveUnitPricesForList,
} from "@/lib/price-list-resolve";
import { staffHasPermission } from "@/lib/staff-permissions";

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

  const productsRaw = await searchActiveProductsBase(q, 40);
  const rubroFilter = (req.nextUrl.searchParams.get("rubro") ?? "").trim();
  const products = rubroFilter
    ? productsRaw.filter(
        (p) =>
          (p.rubro ?? "").trim().toLowerCase() === rubroFilter.toLowerCase(),
      )
    : productsRaw;

  let priceListId: string | null = null;

  if (session.user.role === "CUSTOMER" && session.user.customerId) {
    const customer = await getCachedCustomerPricingContext(
      session.user.customerId,
    );
    priceListId = customer?.priceListId ?? null;
  } else if (staffHasPermission(session.user.role, "quotes")) {
    const customerId = (req.nextUrl.searchParams.get("customerId") ?? "").trim();
    if (customerId) {
      const customer = await getCachedCustomerPricingContext(customerId);
      if (!customer) {
        return NextResponse.json(
          { error: "Cliente no encontrado" },
          { status: 404 },
        );
      }
      priceListId = customer.priceListId;
    } else if (
      !(
        staffHasPermission(session.user.role, "stockCatalog") ||
        staffHasPermission(session.user.role, "products")
      )
    ) {
      return NextResponse.json(
        { error: "customerId requerido para precios de cliente" },
        { status: 400 },
      );
    }
  } else if (
    !(
      staffHasPermission(session.user.role, "stockCatalog") ||
      staffHasPermission(session.user.role, "products")
    )
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
