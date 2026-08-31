import { requireStaffPermission } from "@/lib/session";
import { getAdminUsuariosPageData } from "@/lib/admin-usuarios-data";
import { StaffUsersPanel } from "@/components/admin/staff-users-panel";

export default async function AdminUsuariosPage() {
  const session = await requireStaffPermission("users");
  const users = await getAdminUsuariosPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Usuarios</h1>
        <p className="text-sm text-neutral-600">
          Administradores internos con acceso completo al panel.
        </p>
      </div>
      <StaffUsersPanel users={users} currentUserId={session.user.id} />
    </div>
  );
}
