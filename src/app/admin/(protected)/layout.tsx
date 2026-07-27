import { requireAdminSession } from "@/lib/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPushSafe } from "@/components/admin/admin-push-safe";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();

  return (
    <>
      {/* Outside flex shell — toast UI is fixed; must not share crash domain with nav. */}
      <AdminPushSafe />
      <div className="admin-shell">
        <AdminNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
