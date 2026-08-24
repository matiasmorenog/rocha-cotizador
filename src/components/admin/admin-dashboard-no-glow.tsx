"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { isAdminDashboardPath } from "@/lib/admin-theme";

const DASHBOARD_NO_GLOW_ATTR = "data-admin-dashboard-no-glow";

/** Strip admin dark card glow on `/admin` only (sidebar + main). */
export function AdminDashboardNoGlow() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isAdminDashboardPath(pathname)) {
      root.setAttribute(DASHBOARD_NO_GLOW_ATTR, "");
    } else {
      root.removeAttribute(DASHBOARD_NO_GLOW_ATTR);
    }
    return () => root.removeAttribute(DASHBOARD_NO_GLOW_ATTR);
  }, [pathname]);

  return null;
}
