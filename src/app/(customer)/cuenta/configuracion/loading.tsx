import { CustomerModuleLoading } from "@/components/customer/customer-module-loading";
import { SkeletonCustomerCuentaPanel } from "@/components/ui/skeleton";

export default function CustomerCuentaConfigLoading() {
  return (
    <CustomerModuleLoading path="/cuenta">
      <SkeletonCustomerCuentaPanel />
    </CustomerModuleLoading>
  );
}
