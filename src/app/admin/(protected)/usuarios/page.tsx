import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { StaffUsersPanel } from "@/components/admin/staff-users-panel";
import { SkeletonAdminListBody } from "@/components/ui/skeleton";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { getAdminUsuariosPageData } from "@/lib/admin-usuarios-data";
import { requireStaffPermission } from "@/lib/session";

async function UsuariosBody({ currentUserId }: { currentUserId: string }) {
  const users = await getAdminUsuariosPageData();
  return <StaffUsersPanel users={users} currentUserId={currentUserId} />;
}

export default async function AdminUsuariosPage() {
  const session = await requireStaffPermission("users");
  const chrome = adminModuleChromeForPath("/admin/usuarios")!;

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={chrome.description}
      />
      <Suspense fallback={<SkeletonAdminListBody />}>
        <UsuariosBody currentUserId={session.user.id} />
      </Suspense>
    </div>
  );
}
