import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { AdminNewQuoteForm } from "@/components/admin/admin-new-quote-form";
import { CotizacionesTransitionLink } from "@/components/admin/cotizaciones-route-transition";
import { getOrderCutoffHourAr } from "@/lib/business-settings";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { requireStaffPermission } from "@/lib/session";

export default async function AdminNuevaCotizacionPage() {
  await requireStaffPermission("quotes");
  const orderCutoffHourAr = await getOrderCutoffHourAr();
  const chrome = adminModuleChromeForPath("/admin/cotizaciones/nueva")!;

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={chrome.description}
        actions={
          <CotizacionesTransitionLink
            href="/admin/cotizaciones"
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            Volver al listado
          </CotizacionesTransitionLink>
        }
      />
      <AdminNewQuoteForm orderCutoffHourAr={orderCutoffHourAr} />
    </div>
  );
}
