import { requireStaffSession } from "@/lib/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageSafe } from "@/components/admin/admin-page-safe";
import { AdminPushSafe } from "@/components/admin/admin-push-safe";
import { AdminThemeProvider } from "@/components/admin/admin-theme-provider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();
  const permissions = session.user.permissions ?? [];

  return (
    <>
      <AdminPushSafe />
      <AdminThemeProvider>
        <div className="admin-shell">
          <AdminNav permissions={permissions} />
          <div className="min-w-0 flex-1">
            <AdminPageSafe>{children}</AdminPageSafe>
          </div>
        </div>
      </AdminThemeProvider>
    </>
  );
}
