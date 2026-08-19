import { CustomerRemitosPanel } from "@/components/customer/customer-remitos-panel";
import { getCustomerRemitos } from "@/lib/customer-remitos-data";
import { requireCustomerSession } from "@/lib/session";

/** Always hit DB — never serve a statically cached remitos list after deletes/wipes. */
export const dynamic = "force-dynamic";

export default async function RemitosPage() {
  const session = await requireCustomerSession();
  const remitos = await getCustomerRemitos(session.user.customerId!);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Mis remitos</h1>
      <CustomerRemitosPanel initialRemitos={remitos} />
    </div>
  );
}
