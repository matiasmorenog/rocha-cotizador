import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { CustomerCuentaConfigLoader } from "@/components/customer/customer-cuenta-config-loader";
import { SkeletonCustomerCuentaPanel } from "@/components/ui/skeleton";
import { requireCustomerSession } from "@/lib/session";

export default async function AccountConfigPage() {
  const session = await requireCustomerSession();

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title="Configuración"
        description={`${session.user.name} · código ${session.user.customerCode}`}
      />

      <Suspense fallback={<SkeletonCustomerCuentaPanel />}>
        <CustomerCuentaConfigLoader />
      </Suspense>
    </div>
  );
}
