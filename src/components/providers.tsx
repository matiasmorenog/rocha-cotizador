"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { AdminThemeProvider } from "@/components/admin/admin-theme-provider";
import { RouteLoadingOverlay } from "@/components/route-loading-overlay";
import { RouteLoadingProvider } from "@/lib/route-loading-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminThemeProvider>
        <RouteLoadingProvider>
          <Suspense fallback={null}>
            <RouteLoadingOverlay />
          </Suspense>
          {children}
        </RouteLoadingProvider>
      </AdminThemeProvider>
    </SessionProvider>
  );
}
