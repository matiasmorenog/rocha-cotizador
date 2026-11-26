/** Shared cache tags — never put per-customer unitPrice or auth under these.
 *  Keep `scripts/post-deploy-cache.sh` TAGS in sync when adding one. */
export const CACHE_TAGS = {
  products: "products",
  priceLists: "price-lists",
  /** customerId → priceListId mapping (not unit prices). */
  customers: "customers",
  /** KPI counts + recent quotes + cotizaciones list. */
  adminDashboard: "admin-dashboard",
  /**
   * Quote-activity chart series only. Not busted on every quote create —
   * soft freshness via TTL; wipe / full revalidate still clears it.
   */
  adminQuoteActivity: "admin-quote-activity",
  staffUsers: "staff-users",
  subscriptionPayments: "subscription-payments",
} as const;
