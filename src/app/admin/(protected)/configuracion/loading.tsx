import { AdminModuleLoading } from "@/components/admin/admin-module-loading";
import { SkeletonAdminConfigPage } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AdminModuleLoading path="/admin/configuracion">
      <SkeletonAdminConfigPage />
    </AdminModuleLoading>
  );
}
