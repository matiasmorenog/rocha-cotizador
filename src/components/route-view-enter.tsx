"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

/** Fade/slide enter when a route settles after soft nav (home hub motion). */
export function RouteViewEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { pending } = useRouteLoading();

  return (
    <div
      key={pathname}
      className={cn(
        "min-w-0",
        pending ? "pointer-events-none opacity-0" : "route-view-enter",
      )}
    >
      {children}
    </div>
  );
}
