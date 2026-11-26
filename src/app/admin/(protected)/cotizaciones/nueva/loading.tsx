import { AdminModuleLoading } from "@/components/admin/admin-module-loading";
import { SkeletonAdminNewQuotePage } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminModuleLoading path="/admin/cotizaciones/nueva">
      <SkeletonAdminNewQuotePage />
    </AdminModuleLoading>
  );
}
