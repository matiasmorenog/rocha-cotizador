"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyAdminThemeToDocument,
  persistAdminTheme,
  readStoredAdminTheme,
  type AdminTheme,
} from "@/lib/admin-theme";

const ADMIN_THEME_EVENT = "rocha-admin-theme-change";

function subscribeAdminTheme(onStoreChange: () => void) {
  window.addEventListener(ADMIN_THEME_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(ADMIN_THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getAdminThemeSnapshot(): AdminTheme {
  return readStoredAdminTheme();
}

function getAdminThemeServerSnapshot(): AdminTheme {
  return "light";
}

function notifyAdminThemeChange() {
  window.dispatchEvent(new Event(ADMIN_THEME_EVENT));
}

type AdminThemeContextValue = {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
  toggleTheme: () => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeAdminTheme,
    getAdminThemeSnapshot,
    getAdminThemeServerSnapshot,
  );

  useLayoutEffect(() => {
    applyAdminThemeToDocument(theme);
    return () => applyAdminThemeToDocument("light");
  }, [theme]);

  const setTheme = useCallback((next: AdminTheme) => {
    persistAdminTheme(next);
    applyAdminThemeToDocument(next);
    notifyAdminThemeChange();
  }, []);

  const toggleTheme = useCallback(() => {
    const next: AdminTheme = readStoredAdminTheme() === "dark" ? "light" : "dark";
    setTheme(next);
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return ctx;
}
