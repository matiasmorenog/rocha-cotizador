import { AdminModuleLoading } from "@/components/admin/admin-module-loading";
import { SkeletonAdminStockPage } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminModuleLoading path="/admin/stock">
      <SkeletonAdminStockPage />
    </AdminModuleLoading>
  );
}
