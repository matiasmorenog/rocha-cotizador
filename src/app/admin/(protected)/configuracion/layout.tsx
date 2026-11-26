import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { ConfigHashRedirect } from "@/components/admin/config-hash-redirect";
import {
  ConfigTabPanel,
  ConfigTabTransition,
} from "@/components/admin/config-tab-transition";
import { ConfigTabs } from "@/components/admin/config-tabs";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";

export default function AdminConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chrome = adminModuleChromeForPath("/admin/configuracion")!;

  return (
    <ConfigTabTransition>
      <div className="space-y-6">
        <Suspense fallback={null}>
          <ConfigHashRedirect />
        </Suspense>

        <AdminModulePageHeader
          title={chrome.title}
          description={chrome.description}
        />

        <Suspense fallback={null}>
          <ConfigTabs />
        </Suspense>

        <ConfigTabPanel>{children}</ConfigTabPanel>
      </div>
    </ConfigTabTransition>
  );
}
