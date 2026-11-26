import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { CotizarQuoteBuilder } from "@/components/quote/cotizar-quote-builder-lazy";
import { getOrderCutoffHourAr } from "@/lib/business-settings";
import { requireCustomerSession } from "@/lib/session";

export default async function CotizarPage() {
  const [session, orderCutoffHourAr] = await Promise.all([
    requireCustomerSession(),
    getOrderCutoffHourAr(),
  ]);

  return (
    <div className="space-y-4">
      <AdminModulePageHeader
        title="Nueva cotización"
        description={`${session.user.name} · código ${session.user.customerCode}`}
      />
      <CotizarQuoteBuilder orderCutoffHourAr={orderCutoffHourAr} />
    </div>
  );
}
