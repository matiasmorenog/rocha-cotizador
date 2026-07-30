"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { RouteLoadingOverlay } from "@/components/route-loading-overlay";
import { RouteLoadingProvider } from "@/lib/route-loading-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RouteLoadingProvider>
        <Suspense fallback={null}>
          <RouteLoadingOverlay />
        </Suspense>
        {children}
      </RouteLoadingProvider>
    </SessionProvider>
  );
}
