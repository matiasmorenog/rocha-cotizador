import { Suspense } from "react";
import { ConfigPanelSkeleton } from "@/components/admin/config-panel-skeleton";
import { SkeletonAdminConfigCuentaPanel } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Suspense fallback={<SkeletonAdminConfigCuentaPanel />}>
      <ConfigPanelSkeleton />
    </Suspense>
  );
}
