"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLayoutEffect, type ReactNode } from "react";
import {
  applyAdminThemeToDocument,
  shouldApplyAdminTheme,
} from "@/lib/admin-theme";
import { useAdminThemeStore } from "@/lib/admin-theme-store";
import { isAdminPanelRole } from "@/lib/staff-permissions";

export function AdminThemeProvider({
  children,
  isStaff: isStaffInitial,
}: {
  children: ReactNode;
  isStaff: boolean;
}) {
  const theme = useAdminThemeStore();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isStaff =
    status === "loading"
      ? isStaffInitial
      : isAdminPanelRole(session?.user?.role);

  useLayoutEffect(() => {
    if (!shouldApplyAdminTheme(pathname, isStaff)) {
      applyAdminThemeToDocument("light");
      return;
    }
    applyAdminThemeToDocument(theme);
  }, [theme, pathname, isStaff]);

  return <>{children}</>;
}
