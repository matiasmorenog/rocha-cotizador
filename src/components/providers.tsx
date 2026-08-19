"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { AdminThemeProvider } from "@/components/admin/admin-theme-provider";
import { ClientBuildGuard } from "@/components/client-build-guard";
import { RouteLoadingOverlay } from "@/components/route-loading-overlay";
import { RouteLoadingProvider } from "@/lib/route-loading-context";

export function Providers({
  children,
  isStaff,
}: {
  children: React.ReactNode;
  isStaff: boolean;
}) {
  return (
    <SessionProvider>
      <AdminThemeProvider isStaff={isStaff}>
        <RouteLoadingProvider>
          <ClientBuildGuard />
          <Suspense fallback={null}>
            <RouteLoadingOverlay />
          </Suspense>
          {children}
        </RouteLoadingProvider>
      </AdminThemeProvider>
    </SessionProvider>
  );
}
