import { Suspense } from "react";
import { ConfigHashRedirect } from "@/components/admin/config-hash-redirect";
import {
  ConfigTabPanel,
  ConfigTabTransition,
} from "@/components/admin/config-tab-transition";
import { ConfigTabs } from "@/components/admin/config-tabs";

export default function AdminConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigTabTransition>
      <div className="space-y-6">
        <Suspense fallback={null}>
          <ConfigHashRedirect />
        </Suspense>

        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Configuración</h1>
          <p className="text-sm text-neutral-600">
            Ajustes del cotizador y de tu cuenta.
          </p>
        </div>

        <Suspense fallback={null}>
          <ConfigTabs />
        </Suspense>

        <ConfigTabPanel>{children}</ConfigTabPanel>
      </div>
    </ConfigTabTransition>
  );
}
