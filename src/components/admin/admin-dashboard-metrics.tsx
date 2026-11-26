import Link from "next/link";
import { Suspense } from "react";
import { AdminDashboardChartLoader } from "@/components/admin/admin-dashboard-chart-loader";
import { AdminDashboardKpiSection } from "@/components/admin/admin-dashboard-kpi-section";
import { AdminDashboardReveal } from "@/components/admin/admin-dashboard-reveal";
import { RecentQuotesList } from "@/components/admin/recent-quotes-list";
import { SkeletonAdminQuoteActivityCard } from "@/components/ui/skeleton";
import { getAdminDashboardData } from "@/lib/admin-dashboard-cache";
import type { DashboardKpiValues } from "@/lib/admin-dashboard-kpi-catalog";
import type { QuoteActivityPeriod } from "@/lib/admin-quote-activity";
import { formatPrice } from "@/lib/utils";

type Props = {
  canQuotes: boolean;
  isAdmin: boolean;
  chartPeriod: QuoteActivityPeriod;
  userId?: string | null;
};

function buildKpiValues(
  data: Awaited<ReturnType<typeof getAdminDashboardData>>,
): DashboardKpiValues {
  return {
    quotesToday: {
      value: data.quotesToday,
      hint: `${formatPrice(data.quotesTodayTotal)} · ayer ${data.quotesYesterday}`,
    },
    customersQuotedToday: {
      value: data.customersQuotedToday,
      hint: `esta semana: ${data.customersQuotedWeek}`,
    },
    pendingWeighAll: {
      value: data.pendingWeighLines,
      hint:
        data.pendingWeighLines > 0
          ? "todas las líneas · orderByUnit / $0"
          : "Sin pendientes",
    },
    deliveriesToday: {
      value: data.deliveriesToday,
      hint: "remitos con deliveryDate = hoy",
    },
    pendingWeighLive: {
      value: data.pendingWeighLive,
      hint: "entrega hoy/ayer o creados ≤7d",
    },
    activeCustomersNoQuoteWeek: {
      value: data.activeCustomersNoQuoteWeek,
      hint: "clientes active sin quote desde lunes",
    },
    submittedQuotesToday: {
      value: data.submittedQuotesToday,
      hint: "status SUBMITTED · creados hoy",
    },
    branchesMissingDesperdicioToday: {
      value: data.branchesMissingDesperdicioToday,
      hint: "módulo DESPERDICIOS habilitado, sin cierre",
    },
  };
}

/**
 * Async KPI + recent (and nested chart Suspense). Streamed under the
 * dashboard shell so header/CTA paint before Neon round-trips finish.
 * KPI visibility is client-picked (max 3); one cached SQL loads the catalog.
 */
export async function AdminDashboardMetrics({
  canQuotes,
  isAdmin,
  chartPeriod,
  userId,
}: Props) {
  const data = await getAdminDashboardData();
  const kpiValues = buildKpiValues(data);

  return (
    <AdminDashboardReveal>
      {canQuotes ? (
        <AdminDashboardKpiSection values={kpiValues} userId={userId} />
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
          <RecentQuotesList recent={data.recent} />
        </div>
      ) : null}
    </AdminDashboardReveal>
  );
}
