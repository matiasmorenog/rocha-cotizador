"use client";

import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

export function HeaderProgressLine() {
  const { progress, visible } = useRouteLoading();

  return (
    <div
      className={cn(
        "pointer-events-none h-0.5 w-full shrink-0 overflow-hidden bg-transparent",
        !visible && "opacity-0",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "h-full bg-[var(--brand-primary)]",
          "route-loading-fill",
          visible && progress >= 100 && "route-loading-fill-done",
        )}
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
  );
}
