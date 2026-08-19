export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "rocha-admin-theme";

/** Auth screens always render light; dark applies only inside the admin shell. */
export const ADMIN_LOGIN_PATHS = ["/login", "/entrar", "/admin/login"] as const;

export function isLoginPath(path: string): boolean {
  return (ADMIN_LOGIN_PATHS as readonly string[]).includes(path);
}

/** Inline <head> script: set data-admin-theme before first paint (no FOUC). */
export const ADMIN_THEME_BLOCKING_SCRIPT = `(function(){try{var p=location.pathname;var L=${JSON.stringify(ADMIN_LOGIN_PATHS)};if(L.indexOf(p)!==-1)return;if(localStorage.getItem(${JSON.stringify(ADMIN_THEME_STORAGE_KEY)})==="dark"){document.documentElement.setAttribute("data-admin-theme","dark")}}catch(e){}})();`;

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
