import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getActiveProductsBase,
  getProductsCatalogVersion,
} from "@/lib/products-cache";

/**
 * Shared base catalog + version for browser cache.
 * `priceFactor` = 1 - discount/100 (never exposes discountPercent key).
 * Conditional: `?v=` matching current version → products omitted.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const version = await getProductsCatalogVersion();
  const priceFactor = 1 - discountPercent / 100;
  const clientVersion =
    req.nextUrl.searchParams.get("v")?.trim() ||
    req.headers.get("If-None-Match")?.replaceAll('"', "").trim() ||
    "";

  if (clientVersion && clientVersion === version) {
    return NextResponse.json(
      { unchanged: true, version, priceFactor, products: [] as const },
      {
        headers: {
          ETag: `"${version}"`,
          "Cache-Control": "private, no-cache",
        },
      },
    );
  }

  const products = await getActiveProductsBase();

  return NextResponse.json(
    { unchanged: false, version, priceFactor, products },
    {
      headers: {
        ETag: `"${version}"`,
        "Cache-Control": "private, no-cache",
      },
    },
  );
}
