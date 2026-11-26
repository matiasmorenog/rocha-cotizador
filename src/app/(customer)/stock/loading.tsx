import { CustomerModuleLoading } from "@/components/customer/customer-module-loading";
import { SkeletonCustomerStockPage } from "@/components/ui/skeleton";

export default function CustomerStockLoading() {
  return (
    <CustomerModuleLoading path="/stock">
      <SkeletonCustomerStockPage withShell={false} />
    </CustomerModuleLoading>
  );
}
