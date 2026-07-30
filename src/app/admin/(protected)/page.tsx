import Link from "next/link";
import { Suspense } from "react";
import { AdminQuoteActivityChart } from "@/components/admin/admin-quote-activity-chart";
import { AdminQuoteActivityPeriodTabs } from "@/components/admin/admin-quote-activity-period-tabs";
import { getAdminDashboardData } from "@/lib/admin-dashboard-cache";
import {
  getAdminQuoteActivity,
  QUOTE_ACTIVITY_PERIOD_LABELS,
  parseQuoteActivityPeriod,
} from "@/lib/admin-quote-activity";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn, formatPrice } from "@/lib/utils";

/** Dynamic shell; dashboard payload uses tagged Data Cache (TTL 1h, bust on quote create / wipe). */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ chart?: string }>;
}) {
  const { chart: chartParam } = await searchParams;
  const chartPeriod = parseQuoteActivityPeriod(chartParam);
  const periodLabels = QUOTE_ACTIVITY_PERIOD_LABELS[chartPeriod];

  const [
    {
      quotesToday,
      quotesTodayTotal,
      quotesYesterday,
      customersQuotedToday,
      customersQuotedWeek,
      pendingWeighLines,
      recent,
    },
    activity,
  ] = await Promise.all([
    getAdminDashboardData(),
    getAdminQuoteActivity(chartPeriod),
  ]);

  const stats: { label: string; value: number | string; hint: string }[] = [
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
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <Link
          href="/admin/cotizaciones/nueva"
          className={cn(
            "inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm text-white hover:opacity-90",
            FOCUS_BRAND_PRIMARY,
          )}
        >
          Nueva cotización
        </Link>
      </div>
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

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-neutral-900">Actividad de cotizaciones</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {periodLabels.description}
            </p>
          </div>
          <Suspense
            fallback={
              <div
                className="h-9 w-36 animate-pulse rounded-lg bg-neutral-100"
                aria-hidden
              />
            }
          >
            <AdminQuoteActivityPeriodTabs period={chartPeriod} />
          </Suspense>
        </div>
        <AdminQuoteActivityChart
          period={activity.period}
          data={activity.points}
          totalQuotes={activity.totalQuotes}
          totalRevenue={activity.totalRevenue}
          summaryLabel={periodLabels.summary}
          emptyLabel={periodLabels.empty}
        />
      </section>

      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="font-medium text-neutral-900">Últimas cotizaciones</h2>
          <Link href="/admin/cotizaciones" className="text-sm text-[var(--brand-primary)]">
            Ver todas
          </Link>
        </div>
        <ul className="divide-y divide-neutral-100 text-sm">
          {recent.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/remitos/${q.id}`} className="font-medium hover:underline">
                  {q.number}
                </Link>
                <p className="text-neutral-500">
                  {q.customer.code} — {q.customer.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatPrice(q.total)}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(q.createdAt).toLocaleString("es-AR")}
                </p>
              </div>
            </li>
          ))}
          {recent.length === 0 ? (
            <li className="px-4 py-8 text-center text-neutral-500">Sin cotizaciones aún</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
