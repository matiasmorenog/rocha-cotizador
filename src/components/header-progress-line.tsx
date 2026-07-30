"use client";

import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

export function HeaderProgressLine() {
  const { progress } = useRouteLoading();
  const pct = Math.max(0, Math.min(100, progress));
  const done = pct >= 100;

  return (
    <div
      className={cn(
        "pointer-events-none h-0.5 w-full shrink-0 overflow-hidden",
        done ? "bg-[var(--brand-primary)]" : "bg-neutral-200/70",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "h-full bg-[var(--brand-primary)]",
          "route-loading-fill",
          done && "route-loading-fill-done",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
