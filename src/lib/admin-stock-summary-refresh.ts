/** Client event to refetch admin stock summary (chart/cards) after a recount save. */

export const ADMIN_STOCK_SUMMARY_REFRESH_EVENT = "rocha-admin-stock-summary-refresh";

export function dispatchAdminStockSummaryRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_STOCK_SUMMARY_REFRESH_EVENT));
}
