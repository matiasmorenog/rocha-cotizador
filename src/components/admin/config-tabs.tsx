"use client";

import { useSearchParams } from "next/navigation";
import { ConfigTabLink } from "@/components/admin/config-tab-transition";
import { SolapasTabList } from "@/components/ui/solapas-tabs";
import {
  CONFIG_TABS,
  parseConfigTab,
  type ConfigTab,
} from "@/lib/admin-config-tabs";

const TAB_LABELS: Record<ConfigTab, string> = {
  cotizaciones: "Cotizaciones",
  notificaciones: "Notificaciones",
  servicio: "Servicio",
  cuenta: "Cuenta",
};

function tabHref(tab: ConfigTab) {
  return `/admin/configuracion?tab=${tab}`;
}

export function ConfigTabs() {
  const searchParams = useSearchParams();
  const active = parseConfigTab(searchParams.get("tab") ?? undefined);
  const tabs = CONFIG_TABS.map((id) => ({ id, label: TAB_LABELS[id] }));

  return (
    <SolapasTabList activeKey={active} aria-label="Configuración">
      {tabs.map((tab) => (
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
