"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

/**
 * Enter animation for dashboard metrics that stream under Suspense.
 *
 * Do **not** put `.route-view-enter` on the first paint: fill-mode `both`
 * burns the keyframes while `RouteViewEnter` / pending still keep the tree
 * at `opacity-0`, so KPIs appear already finished (no visible enter).
 *
 * Gate until route settle (`!pending`), then remount a fresh node with the
 * enter class — same pattern as `RouteViewEnter`.
 */
export function AdminDashboardReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useRouteLoading();
  const [enterKey, setEnterKey] = useState(0);
  const wasPendingRef = useRef(true);

  useLayoutEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }
    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      setEnterKey((key) => key + 1);
    }
  }, [pending]);

  const gated = pending || enterKey === 0;

  if (gated) {
    return (
      <div
        className={cn(
          "pointer-events-none space-y-6 opacity-0",
          className,
        )}
        aria-hidden
        data-admin-dashboard-reveal="gated"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      key={enterKey}
      className={cn("route-view-enter space-y-6", className)}
      data-admin-dashboard-reveal="enter"
      data-admin-dashboard-enter-key={enterKey}
    >
      {children}
    </div>
  );
}
