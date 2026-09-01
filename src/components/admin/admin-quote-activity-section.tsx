"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SolapasTabButton,
  SolapasTabContent,
  SolapasTabList,
} from "@/components/ui/solapas-tabs";
import {
  QUOTE_ACTIVITY_PERIOD_LABELS,
  type QuoteActivityPeriod,
  type QuoteActivityPoint,
} from "@/lib/admin-quote-activity-shared";
import { cn } from "@/lib/utils";

const AdminQuoteActivityChart = dynamic(
  () =>
    import("@/components/admin/admin-quote-activity-chart").then(
      (m) => m.AdminQuoteActivityChart,
    ),
  {
    loading: () => (
      <Skeleton className="h-44 w-full rounded-md sm:h-48" aria-hidden />
    ),
  },
);

const PERIODS: QuoteActivityPeriod[] = ["week", "month", "year"];

type ActivitySnapshot = {
  period: QuoteActivityPeriod;
  points: QuoteActivityPoint[];
  totalQuotes: number;
  totalRevenue: number;
};

type AdminQuoteActivitySectionProps = {
  /** Server-rendered activity for the initial period — no client fetch on first paint. */
  initial: ActivitySnapshot;
};

/**
 * Dashboard "Actividad de cotizaciones" card: period toggle (Semana/Mes/Año)
 * fetches only this card's data from `/api/admin/quote-activity`, so KPIs and
 * the recent-quotes list above/below never re-render or re-fetch. One request
 * per toggle; flipping periods quickly aborts the stale in-flight request
 * instead of stacking parallel DB reads.
 */
export function AdminQuoteActivitySection({
  initial,
}: AdminQuoteActivitySectionProps) {
  const [activity, setActivity] = useState<ActivitySnapshot>(initial);
  const [pendingPeriod, setPendingPeriod] = useState<QuoteActivityPeriod | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<QuoteActivityPeriod, ActivitySnapshot>>(
    new Map([[initial.period, initial]]),
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const selectPeriod = useCallback(
    (period: QuoteActivityPeriod) => {
      if (period === activity.period) return;

      abortRef.current?.abort();

      const cached = cacheRef.current.get(period);
      if (cached) {
        setActivity(cached);
        setPendingPeriod(null);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setPendingPeriod(period);

      fetch(`/api/admin/quote-activity?period=${period}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`quote-activity fetch failed: ${res.status}`);
          return res.json() as Promise<ActivitySnapshot>;
        })
        .then((data) => {
          cacheRef.current.set(period, data);
          setActivity(data);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error("[admin-quote-activity] fetch failed", err);
        })
        .finally(() => {
          if (abortRef.current === controller) {
            setPendingPeriod(null);
            abortRef.current = null;
          }
        });
    },
    [activity.period],
  );

  const labels = QUOTE_ACTIVITY_PERIOD_LABELS[activity.period];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-neutral-900">Actividad de cotizaciones</h2>
          <p className="mt-0.5 text-sm text-neutral-500">{labels.description}</p>
        </div>
        <SolapasTabList
          activeKey={activity.period}
          aria-label="Período del gráfico"
          size="sm"
        >
          {PERIODS.map((value) => (
            <SolapasTabButton
              key={value}
              selected={activity.period === value}
              disabled={pendingPeriod === value}
              onClick={() => selectPeriod(value)}
              size="sm"
              className={cn(pendingPeriod === value && "opacity-60")}
            >
              {QUOTE_ACTIVITY_PERIOD_LABELS[value].short}
            </SolapasTabButton>
          ))}
        </SolapasTabList>
      </div>

      <SolapasTabContent tabKey={activity.period}>
        <div className={cn(pendingPeriod && "opacity-70 transition-opacity")}>
          <AdminQuoteActivityChart
            period={activity.period}
            data={activity.points}
            totalQuotes={activity.totalQuotes}
            totalRevenue={activity.totalRevenue}
            summaryLabel={labels.summary}
            emptyLabel={labels.empty}
          />
        </div>
      </SolapasTabContent>
    </section>
  );
}
