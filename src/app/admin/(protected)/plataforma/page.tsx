import { requireSuperuser } from "@/lib/session";
import { getSubscriptionPayments } from "@/lib/subscription-payments";
import { PlatformPaymentsPanel } from "@/components/admin/platform-payments-panel";

export default async function PlatformPaymentsPage() {
  await requireSuperuser();
  const payments = await getSubscriptionPayments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Pagos de plataforma
        </h1>
        <p className="text-sm text-neutral-600">
          Registro interno del abono mensual. No figura en el menú.
        </p>
      </div>
      <PlatformPaymentsPanel payments={payments} />
    </div>
  );
}
