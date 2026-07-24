import { revalidateTag } from "next/cache";

/** Shared cache tags — never put per-customer unitPrice or auth under these. */
export const CACHE_TAGS = {
  products: "products",
  priceLists: "price-lists",
  adminDashboard: "admin-dashboard",
} as const;

/**
 * Expire tagged entries immediately (Route Handlers cannot use updateTag).
 * Next request blocks for fresh data — preferred after admin mutations.
 */
function expireTag(tag: string) {
  revalidateTag(tag, { expire: 0 });
}

export function invalidateProductsCache() {
  expireTag(CACHE_TAGS.products);
}

export function invalidatePriceListsCache() {
  expireTag(CACHE_TAGS.priceLists);
}

export function invalidateAdminDashboardCache() {
  expireTag(CACHE_TAGS.adminDashboard);
}

/** Product create/update/import — catalog + dashboard counts. */
export function invalidateAfterProductMutation() {
  invalidateProductsCache();
  invalidatePriceListsCache();
  invalidateAdminDashboardCache();
}

/** Price list create/update/items — unit prices for customers. */
export function invalidateAfterPriceListMutation() {
  invalidatePriceListsCache();
  invalidateProductsCache();
}

/** Customer create/update/import — dashboard active-customer count. */
export function invalidateAfterCustomerMutation() {
  invalidateAdminDashboardCache();
}

/** Quote create — dashboard “today” + recent list. */
export function invalidateAfterQuoteCreate() {
  invalidateAdminDashboardCache();
}
