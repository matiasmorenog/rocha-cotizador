"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RoutePendingShell } from "@/components/route-pending-shell";

/**
 * Customer / auth shells: blank main on nav start.
 * Admin protected shell owns its own cover inside AdminPageSafe (keeps nav).
 */
export function MainRoutePending({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminShell =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  if (isAdminShell) return children;

  return <RoutePendingShell variant="customer">{children}</RoutePendingShell>;
}
