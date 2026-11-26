import { Suspense } from "react";
import { AdminDashboardHeaderActions } from "@/components/admin/admin-dashboard-header-actions";
import { AdminDashboardMetrics } from "@/components/admin/admin-dashboard-metrics";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { SkeletonAdminDashboardMetrics } from "@/components/ui/skeleton";
import { parseQuoteActivityPeriod } from "@/lib/admin-quote-activity";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { isSuperuserRole } from "@/lib/platform-owner";
import { requireStaffSession } from "@/lib/session";
import { isStaffAdmin, staffHasPermission } from "@/lib/staff-permissions";

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
  const chrome = adminModuleChromeForPath("/admin") ?? { title: "Dashboard" };

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={
          chrome.description ?? "Resumen de cotizaciones y actividad."
        }
        actions={
          <AdminDashboardHeaderActions
            canQuotes={canQuotes}
            userId={session.user.id}
          />
        }
      />

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
