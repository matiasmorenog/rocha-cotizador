export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "rocha-admin-theme";

function isAdminLoginPath(path: string): boolean {
  return path === "/admin/login" || path.startsWith("/admin/login/");
}

/** `/admin` shell except login. Customer auth stays light. */
export function isAdminThemePath(path: string): boolean {
  if (isAdminLoginPath(path)) return false;
  return path === "/admin" || path.startsWith("/admin/");
}

/** Shared remito detail (`/remitos/R-…`), not the customer list `/remitos`. */
export function isRemitoDetailPath(path: string): boolean {
  return path.startsWith("/remitos/");
}

/**
 * Dark theme: admin shell, or remito detail when the viewer is staff.
 * Customers never get dark — even if localStorage still has "dark".
 */
export function shouldApplyAdminTheme(path: string, isStaff: boolean): boolean {
  if (isAdminThemePath(path)) return true;
  return isStaff && isRemitoDetailPath(path);
}

/** Inline <head> script: set data-admin-theme before first paint (no FOUC). */
export function adminThemeBlockingScript(isStaff: boolean): string {
  const staff = isStaff ? "true" : "false";
  const key = JSON.stringify(ADMIN_THEME_STORAGE_KEY);
  return `(function(){try{var p=location.pathname;var strip=function(){document.documentElement.removeAttribute("data-admin-theme")};if(p==="/admin/login"||p.indexOf("/admin/login/")===0){strip();return}var admin=p==="/admin"||p.indexOf("/admin/")===0;var remito=p.indexOf("/remitos/")===0;if(!admin&&!(${staff}&&remito)){strip();return}if(localStorage.getItem(${key})==="dark"){document.documentElement.setAttribute("data-admin-theme","dark")}else{strip()}}catch(e){}})();`;
}

export function readStoredAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function persistAdminTheme(theme: AdminTheme) {
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyAdminThemeToDocument(theme: AdminTheme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.setAttribute("data-admin-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-admin-theme");
  }
}
