import { Suspense } from "react";
import { CotizacionesQuotesLoader } from "@/components/admin/cotizaciones-quotes-loader";
import { SkeletonAdminQuotesPanel } from "@/components/ui/skeleton";
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Cotizaciones</h1>
      <Suspense fallback={<SkeletonAdminQuotesPanel />}>
        <CotizacionesQuotesLoader fromParam={fromParam} toParam={toParam} />
      </Suspense>
    </div>
  );
}
