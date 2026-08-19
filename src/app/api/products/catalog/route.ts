import { NextRequest, NextResponse } from "next/server";
import { getActiveProductsBase } from "@/lib/products-cache";
import { getCachedUnitPricesForCatalog } from "@/lib/price-list-resolve";
import {
  catalogVersionParts,
  resolveCatalogAccess,
} from "@/lib/product-catalog-access";

/**
 * Shared base catalog + per-customer unitPrices map.
 * Conditional: `?v=` matching current version → products omitted (unitPrices always sent).
 */
export async function GET(req: NextRequest) {
  const access = await resolveCatalogAccess(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { priceListId } = access;
  const { stamp, catalogKey } = await catalogVersionParts(priceListId);

  const clientVersion =
    req.nextUrl.searchParams.get("v")?.trim() ||
    req.headers.get("If-None-Match")?.replaceAll('"', "").trim() ||
    "";

  const unitPrices = await getCachedUnitPricesForCatalog(priceListId, stamp);

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
