import { requireStaffPermission } from "@/lib/session";
import { CotizacionesTransitionLink } from "@/components/admin/cotizaciones-route-transition";
import { QuotesAdminPanel } from "@/components/admin/quotes-admin-panel";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import { getAdminCotizacionesQuotes } from "@/lib/admin-cotizaciones-data";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export default async function AdminCotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireStaffPermission("quotes");
  const { from: fromParam, to: toParam } = await searchParams;
  const { from, to, fromLocal, toLocal } = resolveQuotesExportRange(
    fromParam,
    toParam,
  );

  const rows = await getAdminCotizacionesQuotes(from, to, toParam);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Cotizaciones</h1>
        <CotizacionesTransitionLink
          href="/admin/cotizaciones/nueva"
          className={cn(
            "inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:opacity-90",
            FOCUS_BRAND_PRIMARY,
          )}
        >
          Nueva cotización
        </CotizacionesTransitionLink>
      </div>

      <QuotesAdminPanel
        key={`${fromLocal}_${toLocal}`}
        initialQuotes={rows}
        defaultFromLocal={fromLocal}
        defaultToLocal={toLocal}
      />
    </div>
  );
}
