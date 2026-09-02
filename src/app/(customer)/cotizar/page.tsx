import { requireCustomerSession } from "@/lib/session";
import { getOrderCutoffHourAr } from "@/lib/business-settings";
import { CotizarQuoteBuilder } from "@/components/quote/cotizar-quote-builder-lazy";

export default async function CotizarPage() {
  const [session, orderCutoffHourAr] = await Promise.all([
    requireCustomerSession(),
    getOrderCutoffHourAr(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Nueva cotización</h1>
        <p className="text-sm text-neutral-600">
          {session.user.name} · código {session.user.customerCode}
        </p>
      </div>
      <CotizarQuoteBuilder orderCutoffHourAr={orderCutoffHourAr} />
    </div>
  );
}
