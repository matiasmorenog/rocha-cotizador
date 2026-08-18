import { revalidatePath, revalidateTag } from "next/cache";

/** Shared cache tags — never put per-customer unitPrice or auth under these.
 *  Keep `scripts/post-deploy-cache.sh` TAGS in sync when adding one. */
export const CACHE_TAGS = {
  products: "products",
  priceLists: "price-lists",
  /** customerId → priceListId mapping (not unit prices). */
  customers: "customers",
  adminDashboard: "admin-dashboard",
  staffUsers: "staff-users",
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

export function invalidateStaffUsersCache() {
  expireTag(CACHE_TAGS.staffUsers);
}

export function invalidateAdminDashboardCache() {
  expireTag(CACHE_TAGS.adminDashboard);
}

/**
 * Expire every shared Data Cache tag (products, price-lists, customers,
 * admin-dashboard). Used by wipe / DB scripts via POST /api/revalidate.
 */
export function invalidateAllDataCaches() {
  for (const tag of Object.values(CACHE_TAGS)) {
    expireTag(tag);
  }
}

/**
 * Ops / wipe / DB scripts: bust all tagged Data Cache + admin/remitos list paths.
 * Prefer HTTP POST /api/revalidate via `scripts/revalidate-app-cache.ts`
 * (out-of-process). Call in-process only inside the Next.js runtime.
 */
export function invalidateAfterDbScript() {
  invalidateAllDataCaches();
  revalidatePath("/admin");
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/remitos");
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

/** Staff user create/update — admin usuarios list. */
export function invalidateAfterStaffUserMutation() {
  invalidateStaffUsersCache();
}

/** Stock entry create/update — refresh admin stock RSC (history is uncached). */
export function invalidateAfterStockEntryMutation() {
  revalidatePath("/admin/stock");
}

/** Quote create — expire dashboard Data Cache + refresh list routes. */
export function invalidateAfterQuoteCreate() {
  invalidateAdminDashboardCache();
  revalidatePath("/admin");
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/remitos");
}

/** Quote wipe / bulk delete — dashboard tag + list paths (in-app). */
export function invalidateAfterQuoteWipe() {
  invalidateAfterQuoteCreate();
}

/** Admin confirms weigh price on a remito line — refresh detail + lists. */
export function invalidateAfterQuoteItemPriceUpdate(quoteNumber: string) {
  invalidateAdminDashboardCache();
  revalidatePath("/admin");
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/remitos");
  revalidatePath(`/remitos/${quoteNumber}`);
}
