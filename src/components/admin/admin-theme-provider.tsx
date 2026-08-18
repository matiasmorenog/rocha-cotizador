"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { applyAdminThemeToDocument } from "@/lib/admin-theme";
import { useAdminThemeStore } from "@/lib/admin-theme-store";

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAdminThemeStore();

  useLayoutEffect(() => {
    applyAdminThemeToDocument(theme);
  }, [theme]);

  return <>{children}</>;
}
