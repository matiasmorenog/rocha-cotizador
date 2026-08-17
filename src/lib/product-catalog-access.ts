import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getProductsCatalogVersion } from "@/lib/products-cache";
import { getCachedCustomerPricingContext } from "@/lib/price-list-resolve";
import { staffHasPermission } from "@/lib/staff-permissions";

export type CatalogAccess =
  | { ok: true; priceListId: string | null }
  | { ok: false; status: 400 | 401 | 404; error: string };

/** Same auth + price-list resolution as GET /api/products/catalog. */
export async function resolveCatalogAccess(
  req: NextRequest,
): Promise<CatalogAccess> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  if (session.user.role === "CUSTOMER" && session.user.customerId) {
    const customer = await getCachedCustomerPricingContext(
      session.user.customerId,
    );
    return { ok: true, priceListId: customer?.priceListId ?? null };
  }

  if (staffHasPermission(session.user.role, "quotes")) {
    const customerId = (req.nextUrl.searchParams.get("customerId") ?? "").trim();
    if (customerId) {
      const customer = await getCachedCustomerPricingContext(customerId);
      if (!customer) {
        return { ok: false, status: 404, error: "Cliente no encontrado" };
      }
      return { ok: true, priceListId: customer.priceListId };
    }
    if (
      staffHasPermission(session.user.role, "stockReports") ||
      staffHasPermission(session.user.role, "products")
    ) {
      return { ok: true, priceListId: null };
    }
    return {
      ok: false,
      status: 400,
      error: "customerId requerido para precios de cliente",
    };
  }

  if (
    staffHasPermission(session.user.role, "stockReports") ||
    staffHasPermission(session.user.role, "products")
  ) {
    return { ok: true, priceListId: null };
  }

  return { ok: false, status: 401, error: "No autorizado" };
}

export async function catalogVersionParts(priceListId: string | null): Promise<{
  stamp: string;
  catalogKey: string;
}> {
  const stamp = await getProductsCatalogVersion();
  return { stamp, catalogKey: `${stamp}:${priceListId ?? "base"}` };
}
