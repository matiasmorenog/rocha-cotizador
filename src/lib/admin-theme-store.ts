"use client";

import { useSyncExternalStore } from "react";
import {
  applyAdminThemeToDocument,
  persistAdminTheme,
  readStoredAdminTheme,
  type AdminTheme,
} from "@/lib/admin-theme";

export const ADMIN_THEME_EVENT = "rocha-admin-theme-change";

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

export function useAdminThemeStore(): AdminTheme {
  return useSyncExternalStore(
    subscribeAdminTheme,
    getAdminThemeSnapshot,
    getAdminThemeServerSnapshot,
  );
}

export function setAdminTheme(next: AdminTheme) {
  persistAdminTheme(next);
  applyAdminThemeToDocument(next);
  notifyAdminThemeChange();
}

export function toggleAdminTheme() {
  const next: AdminTheme = readStoredAdminTheme() === "dark" ? "light" : "dark";
  setAdminTheme(next);
}
