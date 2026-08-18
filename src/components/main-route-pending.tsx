"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RoutePendingShell } from "@/components/route-pending-shell";
import { useRouteLoading } from "@/lib/route-loading-context";

function isAdminShellPath(path: string) {
  return path.startsWith("/admin") && !path.startsWith("/admin/login");
}

/**
 * Customer / auth shells: cover main on nav start.
 * Admin protected shell owns its own cover inside AdminPageSafe (keeps nav).
 * Remito → admin: pathname is still /remitos/* so this wrapper must use the
 * destination path — otherwise root loading.tsx (or a stale customer cover)
 * can look like login until the admin layout resolves.
 */
export function MainRoutePending({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { pendingPath } = useRouteLoading();

  if (isAdminShellPath(pathname)) return children;

  const dest = pendingPath ?? pathname;
  const variant = isAdminShellPath(dest) ? "admin" : "customer";
  return <RoutePendingShell variant={variant}>{children}</RoutePendingShell>;
}
