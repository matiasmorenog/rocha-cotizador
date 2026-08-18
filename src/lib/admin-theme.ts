export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "rocha-admin-theme";

/** Inline <head> script: set data-admin-theme before first paint (no FOUC). */
export const ADMIN_THEME_BLOCKING_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(ADMIN_THEME_STORAGE_KEY)})==="dark"){document.documentElement.setAttribute("data-admin-theme","dark")}}catch(e){}})();`;

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
