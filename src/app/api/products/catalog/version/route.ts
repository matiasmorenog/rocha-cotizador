import { NextRequest, NextResponse } from "next/server";
import {
  catalogVersionParts,
  resolveCatalogAccess,
} from "@/lib/product-catalog-access";

/**
 * Tiny freshness ping — no products, no unitPrices.
 * Client polls this hourly and only GET /catalog when version differs.
 */
export async function GET(req: NextRequest) {
  const access = await resolveCatalogAccess(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const { catalogKey } = await catalogVersionParts(access.priceListId);

  return NextResponse.json(
    { version: catalogKey },
    {
      headers: {
        ETag: `"${catalogKey}"`,
        "Cache-Control": "private, no-cache",
      },
    },
  );
}
