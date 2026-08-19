import { Suspense } from "react";
import { AdminNewQuoteForm } from "@/components/admin/admin-new-quote-form";
import { CotizacionesTransitionLink } from "@/components/admin/cotizaciones-route-transition";
import { requireStaffPermission } from "@/lib/session";

export default async function AdminNuevaCotizacionPage() {
  await requireStaffPermission("quotes");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Nueva cotización
          </h1>
          <p className="text-sm text-neutral-600">
            Armá una cotización en nombre de un cliente.
          </p>
        </div>
        <CotizacionesTransitionLink
          href="/admin/cotizaciones"
          className="text-sm text-[var(--brand-primary)] hover:underline"
        >
          Volver al listado
        </CotizacionesTransitionLink>
      </div>
      <Suspense fallback={<p className="text-sm text-neutral-500">Cargando…</p>}>
        <AdminNewQuoteForm />
      </Suspense>
    </div>
  );
}
