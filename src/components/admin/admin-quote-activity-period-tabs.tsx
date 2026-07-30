"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  QUOTE_ACTIVITY_PERIOD_LABELS,
  type QuoteActivityPeriod,
} from "@/lib/admin-quote-activity-shared";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

const PERIODS: QuoteActivityPeriod[] = ["week", "month", "year"];

type AdminQuoteActivityPeriodTabsProps = {
  period: QuoteActivityPeriod;
};

function buildPeriodHref(
  next: QuoteActivityPeriod,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (next === "week") params.delete("chart");
  else params.set("chart", next);
  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

export function AdminQuoteActivityPeriodTabs({
  period,
}: AdminQuoteActivityPeriodTabsProps) {
  const searchParams = useSearchParams();

  return (
    <div
      className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
      role="tablist"
      aria-label="Período del gráfico"
    >
      {PERIODS.map((value) => (
        <Link
          key={value}
          href={buildPeriodHref(value, searchParams)}
          scroll={false}
          role="tab"
          aria-selected={period === value}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
            FOCUS_BRAND_OUTLINE,
            period === value
              ? "bg-white text-[var(--brand-primary)] shadow-sm"
              : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
          )}
        >
          {QUOTE_ACTIVITY_PERIOD_LABELS[value].short}
        </Link>
      ))}
    </div>
  );
}
