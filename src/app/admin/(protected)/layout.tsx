import { requireStaffSession } from "@/lib/session";
import { permissionsForRole } from "@/lib/staff-permissions";
import type { StaffRole } from "@/types/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPushSafe } from "@/components/admin/admin-push-safe";
import { AdminPageSafe } from "@/components/admin/admin-page-safe";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();
  const permissions = permissionsForRole(session.user.role as StaffRole);

  return (
    <>
      <AdminPushSafe />
      <div className="admin-shell">
        <AdminNav permissions={permissions} />
        <div className="min-w-0 flex-1">
          <AdminPageSafe>{children}</AdminPageSafe>
        </div>
      </div>
    </>
  );
}
