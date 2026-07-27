import { requireAdminSession } from "@/lib/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPushSwRegister } from "@/components/admin/admin-push-sw-register";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
      <AdminPushSwRegister />
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
