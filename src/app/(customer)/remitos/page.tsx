import { CustomerRemitosPanel } from "@/components/customer/customer-remitos-panel";
import {
  defaultFilterDateRange,
  parseArgentinaDateOnlyEndExclusive,
  parseArgentinaDateOnlyStart,
} from "@/lib/argentina-time";
import { getCustomerRemitos } from "@/lib/customer-remitos-data";
import { requireCustomerSession } from "@/lib/session";

/** Always hit DB — never serve a statically cached remitos list after deletes/wipes. */
export const dynamic = "force-dynamic";

export default async function RemitosPage() {
  const session = await requireCustomerSession();
  const { from, to } = defaultFilterDateRange();
  const remitos = await getCustomerRemitos(session.user.customerId!, {
    from: parseArgentinaDateOnlyStart(from)!,
    to: parseArgentinaDateOnlyEndExclusive(to)!,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Mis remitos</h1>
      <CustomerRemitosPanel
        initialRemitos={remitos}
        defaultFrom={from}
        defaultTo={to}
      />
    </div>
  );
}
