import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import type { ReactNode } from "react";

/** Segment loading: real title/description + content skeleton body. */
export function AdminModuleLoading({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const chrome = adminModuleChromeForPath(path);
  return (
    <div className="space-y-6">
      {chrome ? (
        <AdminModulePageHeader
          title={chrome.title}
          description={chrome.description}
          titleClassName={
            path.startsWith("/admin/stock") ||
            path.startsWith("/admin/desperdicios") ||
            path.startsWith("/admin/consumibles") ||
            path.startsWith("/admin/mermas")
              ? "text-xl font-semibold text-neutral-900"
              : undefined
          }
        />
      ) : null}
      {children}
    </div>
  );
}
