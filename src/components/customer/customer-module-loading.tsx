import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { customerModuleChromeForPath } from "@/lib/customer-module-chrome";
import type { ReactNode } from "react";

/** Segment loading: real title/description + content skeleton body. */
export function CustomerModuleLoading({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const chrome = customerModuleChromeForPath(path);
  return (
    <div className="space-y-4">
      {chrome ? (
        <AdminModulePageHeader
          title={chrome.title}
          description={chrome.description}
        />
      ) : null}
      {children}
    </div>
  );
}
