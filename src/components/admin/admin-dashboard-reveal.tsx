"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Enter animation for dashboard metrics that stream under Suspense.
 *
 * `RouteViewEnter` wraps the whole page and remounts on soft-nav settle.
 * That remount can burn `.route-view-enter` on the Suspense fallback (or
 * shell-only), so KPI cards / recent list swap in with no entrance.
 * This wrapper mounts a fresh enter when the real metrics chunk arrives.
 */
export function AdminDashboardReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("route-view-enter space-y-6", className)}>{children}</div>
  );
}
