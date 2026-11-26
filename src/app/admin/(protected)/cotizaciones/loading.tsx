import { AdminModuleLoading } from "@/components/admin/admin-module-loading";
import { SkeletonAdminQuotesPage } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminModuleLoading path="/admin/cotizaciones">
      <SkeletonAdminQuotesPage />
    </AdminModuleLoading>
  );
}
