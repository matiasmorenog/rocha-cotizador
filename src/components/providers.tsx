"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { Suspense } from "react";
import { AdminThemeProvider } from "@/components/admin/admin-theme-provider";
import { ClientBuildGuard } from "@/components/client-build-guard";
import { RouteLoadingOverlay } from "@/components/route-loading-overlay";
import { RouteLoadingProvider } from "@/lib/route-loading-context";

export function Providers({
  children,
  isStaff,
  session,
}: {
  children: React.ReactNode;
  isStaff: boolean;
  /** Server session — skips client /api/auth/session on first paint after refresh. */
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
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
