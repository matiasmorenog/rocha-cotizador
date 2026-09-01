import { Suspense } from "react";
import { CustomerRemitosLoader } from "@/components/customer/customer-remitos-loader";
import { SkeletonCustomerRemitosPanel } from "@/components/ui/skeleton";

/** Always hit DB — never serve a statically cached remitos list after deletes/wipes. */
export const dynamic = "force-dynamic";

export default function RemitosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Mis remitos</h1>
      <Suspense fallback={<SkeletonCustomerRemitosPanel />}>
        <CustomerRemitosLoader />
      </Suspense>
    </div>
  );
}
