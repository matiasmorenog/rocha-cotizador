import Link from "next/link";
import { AdminQuoteActivitySection } from "@/components/admin/admin-quote-activity-section";
import { RecentQuotesList } from "@/components/admin/recent-quotes-list";
import { getAdminDashboardData } from "@/lib/admin-dashboard-cache";
import { getAdminQuoteActivity, parseQuoteActivityPeriod } from "@/lib/admin-quote-activity";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { isSuperuserRole } from "@/lib/platform-owner";
import { requireStaffSession } from "@/lib/session";
import { isStaffAdmin, staffHasPermission } from "@/lib/staff-permissions";
import { cn, formatPrice } from "@/lib/utils";

/** Dynamic shell; dashboard payload uses tagged Data Cache (TTL 24h, bust on quote create / wipe). */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ chart?: string }>;
}) {
  const session = await requireStaffSession();
  const isAdmin = isStaffAdmin(session.user.role) || isSuperuserRole(session.user.role);
  const canQuotes = staffHasPermission(session.user.permissions, "quotes");

  const { chart: chartParam } = await searchParams;
  const chartPeriod = parseQuoteActivityPeriod(chartParam);

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
    isAdmin ? getAdminQuoteActivity(chartPeriod) : Promise.resolve(null),
  ]);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        {canQuotes ? (
          <Link
            href="/admin/cotizaciones/nueva"
            className={cn(
              "inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white shadow-sm hover:opacity-90",
              FOCUS_BRAND_PRIMARY,
            )}
          >
            Nueva cotización
          </Link>
        ) : null}
      </div>
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

      {isAdmin && activity ? (
        <AdminQuoteActivitySection
          initial={{
            period: activity.period,
            points: activity.points,
            totalQuotes: activity.totalQuotes,
            totalRevenue: activity.totalRevenue,
          }}
        />
      ) : null}

      {(isAdmin || canQuotes) ? (<div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="font-medium text-neutral-900">Últimas cotizaciones</h2>
          {canQuotes ? (
            <Link href="/admin/cotizaciones" className="text-sm text-[var(--brand-primary)]">
              Ver todas
            </Link>
          ) : null}
        </div>
        <RecentQuotesList recent={recent} />
      </div>) : null}
    </div>
  );
}
