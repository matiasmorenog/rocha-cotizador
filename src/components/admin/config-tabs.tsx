"use client";

import { useSearchParams } from "next/navigation";
import { ConfigTabLink } from "@/components/admin/config-tab-transition";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { parseConfigTab, type ConfigTab } from "@/lib/admin-config-tabs";
import { cn } from "@/lib/utils";

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
    <div
      role="tablist"
      aria-label="Configuración"
      className="inline-flex gap-1 rounded-lg border border-neutral-200 bg-white p-1"
    >
      {TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <ConfigTabLink
            key={tab.id}
            href={tabHref(tab.id)}
            role="tab"
            aria-selected={selected}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              FOCUS_BRAND_OUTLINE,
              selected
                ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            {tab.label}
          </ConfigTabLink>
        );
      })}
    </div>
  );
}
