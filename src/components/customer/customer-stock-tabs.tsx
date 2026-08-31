"use client";

import Link from "next/link";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import type { StockTab } from "@/lib/admin-stock-data";
import { customerStockTabLabel } from "@/lib/customer-stock-shared";
import { cn } from "@/lib/utils";

export function CustomerStockTabs({
  active,
  tabs,
  from,
  to,
}: {
  active: StockTab;
  tabs: StockTab[];
  from: string;
  to: string;
}) {
  if (tabs.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Stock"
      className="inline-flex gap-1 rounded-lg border border-neutral-200 bg-white p-1"
    >
      {tabs.map((tab) => {
        const selected = active === tab;
        const params = new URLSearchParams({ tab });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        return (
          <Link
            key={tab}
            href={`/stock?${params.toString()}`}
            role="tab"
            aria-selected={selected}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              FOCUS_BRAND_OUTLINE,
              selected
                ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            {customerStockTabLabel(tab)}
          </Link>
        );
      })}
    </div>
  );
}
