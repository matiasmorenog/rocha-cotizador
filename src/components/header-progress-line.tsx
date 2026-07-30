"use client";

import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

export function HeaderProgressLine() {
  const { barState } = useRouteLoading();

  return (
    <div
      className={cn(
        "h-0.5 w-full shrink-0 overflow-hidden",
        barState === "loading" ? "bg-[var(--brand-latte)]/50" : "bg-[var(--brand-primary)]",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "h-full bg-[var(--brand-primary)]",
          barState === "loading"
            ? "route-loading-bar w-[35%]"
            : "route-loading-bar-complete w-full",
        )}
      />
    </div>
  );
}
