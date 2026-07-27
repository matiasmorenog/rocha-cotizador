/** localStorage keys for last successful login identifiers (never passwords/PINs). */
export const LAST_CUSTOMER_CODE_KEY = "rocha:last-customer-code";
export const LAST_ADMIN_EMAIL_KEY = "rocha:last-admin-email";

export function subscribeToLastLoginStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function readLastCustomerCode(): string {
  try {
    const value = localStorage.getItem(LAST_CUSTOMER_CODE_KEY);
    if (!value || !/^\d{1,3}$/.test(value)) return "";
    return value;
  } catch {
    return "";
  }
}

export function saveLastCustomerCode(code: string): void {
  const normalized = code.replace(/\D/g, "").slice(0, 3);
  if (!normalized) return;
  try {
    localStorage.setItem(LAST_CUSTOMER_CODE_KEY, normalized);
  } catch {
    // private mode / quota
  }
}

export function readLastAdminEmail(): string {
  try {
    const value = localStorage.getItem(LAST_ADMIN_EMAIL_KEY)?.trim() ?? "";
    return value.includes("@") ? value : "";
  } catch {
    return "";
  }
}

export function saveLastAdminEmail(email: string): void {
  const normalized = email.trim();
  if (!normalized.includes("@")) return;
  try {
    localStorage.setItem(LAST_ADMIN_EMAIL_KEY, normalized);
  } catch {
    // private mode / quota
  }
}
