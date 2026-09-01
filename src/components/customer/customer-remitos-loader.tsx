import { CustomerRemitosPanel } from "@/components/customer/customer-remitos-panel";
import {
  defaultFilterDateRange,
  parseArgentinaDateOnlyEndExclusive,
  parseArgentinaDateOnlyStart,
} from "@/lib/argentina-time";
import { getCustomerRemitos } from "@/lib/customer-remitos-data";
import { requireCustomerSession } from "@/lib/session";

/** Async segment for Suspense — same remitos query as the former page body. */
export async function CustomerRemitosLoader() {
  const session = await requireCustomerSession();
  const { from, to } = defaultFilterDateRange();
  const remitos = await getCustomerRemitos(session.user.customerId!, {
    from: parseArgentinaDateOnlyStart(from)!,
    to: parseArgentinaDateOnlyEndExclusive(to)!,
  });

  return (
    <CustomerRemitosPanel
      initialRemitos={remitos}
      defaultFrom={from}
      defaultTo={to}
    />
  );
}
