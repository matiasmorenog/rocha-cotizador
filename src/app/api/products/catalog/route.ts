import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getActiveProductsBase,
  getProductsCatalogVersion,
} from "@/lib/products-cache";
import {
  getCachedCustomerPricingContext,
  getCachedUnitPricesForCatalog,
} from "@/lib/price-list-resolve";

/**
 * Shared base catalog + per-customer unitPrices map.
 * Conditional: `?v=` matching current version → products omitted (unitPrices always sent).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let priceListId: string | null = null;

  if (session.user.role === "CUSTOMER" && session.user.customerId) {
    const customer = await getCachedCustomerPricingContext(
      session.user.customerId,
    );
    priceListId = customer?.priceListId ?? null;
  } else if (session.user.role === "ADMIN") {
    const customerId = (req.nextUrl.searchParams.get("customerId") ?? "").trim();
    if (!customerId) {
      return NextResponse.json(
        { error: "customerId requerido para precios de cliente" },
        { status: 400 },
      );
    }
    const customer = await getCachedCustomerPricingContext(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    priceListId = customer.priceListId;
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const version = await getProductsCatalogVersion();
  const listKey = priceListId ?? "base";
  const catalogKey = `${version}:${listKey}`;

  const clientVersion =
    req.nextUrl.searchParams.get("v")?.trim() ||
    req.headers.get("If-None-Match")?.replaceAll('"', "").trim() ||
    "";

  const unitPrices = await getCachedUnitPricesForCatalog(priceListId, version);

  if (clientVersion && clientVersion === catalogKey) {
    return NextResponse.json(
      {
        unchanged: true,
        version: catalogKey,
        priceListId,
        unitPrices,
        products: [] as const,
      },
      {
        headers: {
          ETag: `"${catalogKey}"`,
          "Cache-Control": "private, no-cache",
        },
      },
    );
  }

  const products = await getActiveProductsBase();

  return NextResponse.json(
    {
      unchanged: false,
      version: catalogKey,
      priceListId,
      unitPrices,
      products,
    },
    {
      headers: {
        ETag: `"${catalogKey}"`,
        "Cache-Control": "private, no-cache",
      },
    },
  );
}
