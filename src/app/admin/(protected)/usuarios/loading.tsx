import { AdminModuleLoading } from "@/components/admin/admin-module-loading";
import { SkeletonAdminListPage } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminModuleLoading path="/admin/usuarios">
      <SkeletonAdminListPage label="Cargando usuarios" />
    </AdminModuleLoading>
  );
}
