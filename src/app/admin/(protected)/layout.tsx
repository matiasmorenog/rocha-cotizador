import { requireStaffSession } from "@/lib/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageSafe } from "@/components/admin/admin-page-safe";
import { AdminPushSafe } from "@/components/admin/admin-push-safe";
import { StaffPreviewBanner } from "@/components/admin/staff-preview-ui";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();
  const permissions = session.user.permissions ?? [];
  const previewLabel = session.user.staffPreview?.label;

  return (
    <>
      <AdminPushSafe />
      <div className="admin-shell">
        <AdminNav permissions={permissions} />
        <div className="min-w-0 flex-1 space-y-4">
          {previewLabel ? <StaffPreviewBanner label={previewLabel} /> : null}
          <AdminPageSafe>{children}</AdminPageSafe>
        </div>
      </div>
    </>
  );
}
