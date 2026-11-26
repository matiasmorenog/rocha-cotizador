import { CustomerModuleLoading } from "@/components/customer/customer-module-loading";
import { SkeletonCustomerRemitosPage } from "@/components/ui/skeleton";

export default function RemitosLoading() {
  return (
    <CustomerModuleLoading path="/remitos">
      <SkeletonCustomerRemitosPage withShell={false} />
    </CustomerModuleLoading>
  );
}
