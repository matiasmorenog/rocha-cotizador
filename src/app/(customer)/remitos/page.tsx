import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { CustomerRemitosLoader } from "@/components/customer/customer-remitos-loader";
import { SkeletonCustomerRemitosPanel } from "@/components/ui/skeleton";

/** Always hit DB — never serve a statically cached remitos list after deletes/wipes. */
export const dynamic = "force-dynamic";

export default function RemitosPage() {
  return (
    <div className="space-y-4">
      <AdminModulePageHeader title="Mis remitos" />
      <Suspense fallback={<SkeletonCustomerRemitosPanel />}>
        <CustomerRemitosLoader />
      </Suspense>
    </div>
  );
}
