import Link from "next/link";
import { Suspense } from "react";
import { AdminDashboardChartLoader } from "@/components/admin/admin-dashboard-chart-loader";
import { RecentQuotesList } from "@/components/admin/recent-quotes-list";
import { SkeletonAdminQuoteActivityCard } from "@/components/ui/skeleton";
import { getAdminDashboardData } from "@/lib/admin-dashboard-cache";
import type { QuoteActivityPeriod } from "@/lib/admin-quote-activity";
import { formatPrice } from "@/lib/utils";

type Props = {
  canQuotes: boolean;
  isAdmin: boolean;
  chartPeriod: QuoteActivityPeriod;
};

/**
 * Async KPI + recent (and nested chart Suspense). Streamed under the
 * dashboard shell so header/CTA paint before Neon round-trips finish.
 */
export async function AdminDashboardMetrics({
  canQuotes,
  isAdmin,
  chartPeriod,
}: Props) {
  const {
    quotesToday,
    quotesTodayTotal,
    quotesYesterday,
    customersQuotedToday,
    customersQuotedWeek,
    pendingWeighLines,
    recent,
  } = await getAdminDashboardData();

  const stats: { label: string; value: number | string; hint: string }[] = [
    ...(canQuotes
      ? [
          {
            label: "Cotizaciones hoy",
            value: quotesToday,
            hint: `${formatPrice(quotesTodayTotal)} · ayer ${quotesYesterday}`,
          },
          {
            label: "Clientes que cotizaron hoy",
            value: customersQuotedToday,
            hint: `esta semana: ${customersQuotedWeek}`,
          },
          {
            label: "Líneas pendientes de pesaje",
            value: pendingWeighLines,
            hint:
              pendingWeighLines > 0
                ? "orden por unidad / precio $0"
                : "Sin pendientes",
          },
        ]
      : []),
  ];

  return (
    <>
      {stats.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-neutral-500">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900">
                {s.value}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{s.hint}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          No hay métricas disponibles para tu rol.
        </p>
      )}

      {isAdmin ? (
        <Suspense fallback={<SkeletonAdminQuoteActivityCard />}>
          <AdminDashboardChartLoader period={chartPeriod} />
        </Suspense>
      ) : null}

      {isAdmin || canQuotes ? (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <h2 className="font-medium text-neutral-900">Últimas cotizaciones</h2>
            {canQuotes ? (
              <Link href="/admin/cotizaciones" className="text-sm text-[var(--brand-primary)]">
                Ver todas
              </Link>
            ) : null}
          </div>
          <RecentQuotesList recent={recent} />
        </div>
      ) : null}
    </>
  );
}
