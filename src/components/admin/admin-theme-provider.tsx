"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, type ReactNode } from "react";
import { applyAdminThemeToDocument, isLoginPath } from "@/lib/admin-theme";
import { useAdminThemeStore } from "@/lib/admin-theme-store";

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAdminThemeStore();
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (isLoginPath(pathname)) {
      applyAdminThemeToDocument("light");
      return;
    }
    applyAdminThemeToDocument(theme);
  }, [theme, pathname]);

  return <>{children}</>;
}
