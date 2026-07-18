import { requireCustomerSession } from "@/lib/session";
import { QuoteBuilder } from "@/components/quote/quote-builder";

export default async function CotizarPage() {
  const session = await requireCustomerSession();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Nueva cotización</h1>
        <p className="text-sm text-neutral-600">
          {session.user.name} · código {session.user.customerCode}
        </p>
      </div>
      <QuoteBuilder />
    </div>
  );
}
