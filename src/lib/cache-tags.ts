import { revalidateTag } from "next/cache";

/** Shared cache tags — never put per-customer unitPrice or auth under these. */
export const CACHE_TAGS = {
  products: "products",
  priceLists: "price-lists",
  /** customerId → priceListId mapping (not unit prices). */
  customers: "customers",
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

export function invalidateCustomersCache() {
  expireTag(CACHE_TAGS.customers);
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

/** Price list create/update/items — unit prices; delete may reassign customers. */
export function invalidateAfterPriceListMutation() {
  invalidatePriceListsCache();
  invalidateProductsCache();
  invalidateCustomersCache();
}

/** Customer create/update/import — dashboard count + priceListId mapping. */
export function invalidateAfterCustomerMutation() {
  invalidateCustomersCache();
  invalidateAdminDashboardCache();
}

/** Quote create — dashboard counts may include quotesToday; keep tag warm after create. */
export function invalidateAfterQuoteCreate() {
  invalidateAdminDashboardCache();
}

/** Quote wipe / bulk delete — expire dashboard tags (counts). Lists read DB uncached. */
export function invalidateAfterQuoteWipe() {
  invalidateAdminDashboardCache();
}
