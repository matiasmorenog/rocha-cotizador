/** localStorage preference — in-app admin toasts (default: enabled). */

export const ADMIN_INAPP_PREF_KEY = "rocha-admin-inapp-notifications";
export const ADMIN_INAPP_PREF_EVENT = "rocha-admin-inapp-pref";

export type AdminInAppPrefDetail = { enabled: boolean };

/** Default true when unset. */
export function isAdminInAppNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(ADMIN_INAPP_PREF_KEY);
    if (v === null) return true;
    return v !== "0";
  } catch {
    return true;
  }
}

export function setAdminInAppNotificationsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_INAPP_PREF_KEY, enabled ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(
    new CustomEvent<AdminInAppPrefDetail>(ADMIN_INAPP_PREF_EVENT, {
      detail: { enabled },
    }),
  );
}
