import Link from "next/link";
import { Suspense } from "react";
import { ClipboardPlus } from "lucide-react";
import { AdminDashboardMetrics } from "@/components/admin/admin-dashboard-metrics";
import { SkeletonAdminDashboardMetrics } from "@/components/ui/skeleton";
import { parseQuoteActivityPeriod } from "@/lib/admin-quote-activity";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { isSuperuserRole } from "@/lib/platform-owner";
import { requireStaffSession } from "@/lib/session";
import { isStaffAdmin, staffHasPermission } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

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
            <ClipboardPlus className="mr-1.5 h-4 w-4" aria-hidden />
            Nueva cotización
          </Link>
        ) : null}
      </div>

      <Suspense fallback={<SkeletonAdminDashboardMetrics showChart={isAdmin} />}>
        <AdminDashboardMetrics
          canQuotes={canQuotes}
          isAdmin={isAdmin}
          chartPeriod={chartPeriod}
          userId={session.user.id}
        />
      </Suspense>
    </div>
  );
}
