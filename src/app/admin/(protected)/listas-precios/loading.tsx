import { AdminModuleLoading } from "@/components/admin/admin-module-loading";
import { SkeletonAdminPriceListsPage } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminModuleLoading path="/admin/listas-precios">
      <SkeletonAdminPriceListsPage />
    </AdminModuleLoading>
  );
}
