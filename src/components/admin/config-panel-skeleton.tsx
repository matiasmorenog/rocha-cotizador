"use client";

import { useSearchParams } from "next/navigation";
import { parseConfigTab } from "@/lib/admin-config-tabs";
import {
  SkeletonAdminConfigCuentaPanel,
  SkeletonAdminConfigNotificacionesPanel,
  SkeletonAdminConfigServicioPanel,
} from "@/components/ui/skeleton";

/** Tab-aware skeleton for `/admin/configuracion` panel transitions (`?tab=`). */
export function ConfigPanelSkeleton() {
  const searchParams = useSearchParams();
  const tab = parseConfigTab(searchParams.get("tab") ?? undefined);

  switch (tab) {
    case "notificaciones":
      return <SkeletonAdminConfigNotificacionesPanel />;
    case "servicio":
      return <SkeletonAdminConfigServicioPanel />;
    default:
      return <SkeletonAdminConfigCuentaPanel />;
  }
}
