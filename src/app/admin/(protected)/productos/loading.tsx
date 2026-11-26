import { AdminModuleLoading } from "@/components/admin/admin-module-loading";
import { SkeletonAdminListPage } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminModuleLoading path="/admin/productos">
      <SkeletonAdminListPage label="Cargando productos" />
    </AdminModuleLoading>
  );
}
