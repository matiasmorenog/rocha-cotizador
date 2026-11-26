import { CustomerModuleLoading } from "@/components/customer/customer-module-loading";
import { SkeletonQuotePage } from "@/components/ui/skeleton";

export default function CotizarLoading() {
  return (
    <CustomerModuleLoading path="/cotizar">
      <SkeletonQuotePage withShell={false} />
    </CustomerModuleLoading>
  );
}
