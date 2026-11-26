import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { CotizacionesQuotesLoader } from "@/components/admin/cotizaciones-quotes-loader";
import { SkeletonAdminQuotesPanel } from "@/components/ui/skeleton";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { requireStaffPermission } from "@/lib/session";

/** Always honor `from`/`to` query (dashboard chart deep-links). */
export const dynamic = "force-dynamic";

export default async function AdminCotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireStaffPermission("quotes");
  const { from: fromParam, to: toParam } = await searchParams;
  const chrome = adminModuleChromeForPath("/admin/cotizaciones")!;

  return (
    <div className="space-y-6">
      <AdminModulePageHeader title={chrome.title} description={chrome.description} />
      <Suspense fallback={<SkeletonAdminQuotesPanel />}>
        <CotizacionesQuotesLoader fromParam={fromParam} toParam={toParam} />
      </Suspense>
    </div>
  );
}
