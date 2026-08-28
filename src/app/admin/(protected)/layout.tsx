import { requireStaffSession } from "@/lib/session";
import { AdminSoberDark } from "@/components/admin/admin-sober-dark";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageSafe } from "@/components/admin/admin-page-safe";
import { AdminPushSafe } from "@/components/admin/admin-push-safe";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();
  const permissions = session.user.permissions ?? [];

  return (
    <>
      <AdminSoberDark />
      <AdminPushSafe />
      <div className="admin-shell">
        <AdminNav
          permissions={permissions}
          userName={session.user.name}
          userEmail={session.user.email}
          isSuperuser={Boolean(session.user.isSuperuser)}
        />
        <div className="min-w-0 flex-1">
          <AdminPageSafe>{children}</AdminPageSafe>
        </div>
      </div>
    </>
  );
}
