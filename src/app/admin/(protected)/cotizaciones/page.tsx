import { db } from "@/lib/db";
import { CotizacionesTransitionLink } from "@/components/admin/cotizaciones-route-transition";
import { QuotesAdminPanel } from "@/components/admin/quotes-admin-panel";
import { resolveQuotesExportRange } from "@/lib/argentina-time";
import { formatDateOnlyYmd } from "@/lib/delivery-date";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

/** Always hit DB — quote lists must reflect deletes/wipes immediately. */
export const dynamic = "force-dynamic";

export default async function AdminCotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: fromParam, to: toParam } = await searchParams;
  const { from, to, fromLocal, toLocal } = resolveQuotesExportRange(
    fromParam,
    toParam,
  );

  const quotes = await db.quote.findMany({
    where: { createdAt: { gte: from, lt: to } },
    include: { customer: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = quotes.map((q) => ({
    id: q.id,
    number: q.number,
    status: q.status,
    total: Number(q.total),
    createdAt: q.createdAt.toISOString(),
    deliveryDate: q.deliveryDate ? formatDateOnlyYmd(q.deliveryDate) : null,
    customer: q.customer,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Cotizaciones</h1>
        <CotizacionesTransitionLink
          href="/admin/cotizaciones/nueva"
          className={cn(
            "inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm text-white hover:opacity-90",
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
