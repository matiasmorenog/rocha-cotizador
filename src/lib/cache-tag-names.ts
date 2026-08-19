/** Shared cache tags — never put per-customer unitPrice or auth under these.
 *  Keep `scripts/post-deploy-cache.sh` TAGS in sync when adding one. */
export const CACHE_TAGS = {
  products: "products",
  priceLists: "price-lists",
  /** customerId → priceListId mapping (not unit prices). */
  customers: "customers",
  adminDashboard: "admin-dashboard",
  staffUsers: "staff-users",
  subscriptionPayments: "subscription-payments",
} as const;
