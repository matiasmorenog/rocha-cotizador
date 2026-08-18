/** localStorage: customer promo footer dismissed until storage cleared. */
export const CUSTOMER_PROMO_FOOTER_DISMISSED_KEY =
  "rocha-promo-footer-dismissed";

export const CUSTOMER_PROMO_FOOTER_EVENT = "rocha-promo-footer-dismiss-change";

export function isCustomerPromoFooterDismissed(): boolean {
  try {
    return localStorage.getItem(CUSTOMER_PROMO_FOOTER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissCustomerPromoFooter(): void {
  try {
    localStorage.setItem(CUSTOMER_PROMO_FOOTER_DISMISSED_KEY, "1");
  } catch {
    // private mode / quota
  }
}

export function notifyCustomerPromoFooterChange(): void {
  window.dispatchEvent(new Event(CUSTOMER_PROMO_FOOTER_EVENT));
}

export function subscribeCustomerPromoFooter(onStoreChange: () => void) {
  window.addEventListener(CUSTOMER_PROMO_FOOTER_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CUSTOMER_PROMO_FOOTER_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function readCustomerPromoFooterVisible(): boolean {
  return !isCustomerPromoFooterDismissed();
}
