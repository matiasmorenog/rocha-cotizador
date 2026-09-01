import { Suspense } from "react";
import { CustomerCuentaConfigLoader } from "@/components/customer/customer-cuenta-config-loader";
import { SkeletonCustomerCuentaPanel } from "@/components/ui/skeleton";
import { requireCustomerSession } from "@/lib/session";

export default async function AccountConfigPage() {
  const session = await requireCustomerSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Configuración</h1>
        <p className="text-sm text-neutral-600">
          {session.user.name} · código {session.user.customerCode}
        </p>
      </div>

      <Suspense fallback={<SkeletonCustomerCuentaPanel />}>
        <CustomerCuentaConfigLoader />
      </Suspense>
    </div>
  );
}
