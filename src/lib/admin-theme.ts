export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "rocha-admin-theme";

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

/** Strip dark theme before print; restore after (print output must stay light). */
export function suspendAdminThemeForPrint(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const hadDark = root.getAttribute("data-admin-theme") === "dark";
  if (hadDark) {
    root.removeAttribute("data-admin-theme");
  }
  return () => {
    if (hadDark) {
      root.setAttribute("data-admin-theme", "dark");
    }
  };
}
