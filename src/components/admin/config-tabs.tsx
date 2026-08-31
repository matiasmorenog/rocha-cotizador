"use client";

import { useSearchParams } from "next/navigation";
import { ConfigTabLink } from "@/components/admin/config-tab-transition";
import { SolapasTabList } from "@/components/ui/solapas-tabs";
import { parseConfigTab, type ConfigTab } from "@/lib/admin-config-tabs";

const TABS: Array<{ id: ConfigTab; label: string }> = [
  { id: "notificaciones", label: "Notificaciones" },
  { id: "servicio", label: "Servicio" },
  { id: "cuenta", label: "Cuenta" },
];

function tabHref(tab: ConfigTab) {
  return `/admin/configuracion?tab=${tab}`;
}

export function ConfigTabs() {
  const searchParams = useSearchParams();
  const active = parseConfigTab(searchParams.get("tab") ?? undefined);

  return (
    <SolapasTabList activeKey={active} aria-label="Configuración">
      {TABS.map((tab) => (
        <ConfigTabLink
          key={tab.id}
          href={tabHref(tab.id)}
          selected={active === tab.id}
        >
          {tab.label}
        </ConfigTabLink>
      ))}
    </SolapasTabList>
  );
}
