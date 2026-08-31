import { SkeletonAdminConfigCuentaPanel } from "@/components/ui/skeleton";

export default function CuentaConfigLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-56 animate-pulse rounded-md bg-neutral-100" />
      </div>
      <SkeletonAdminConfigCuentaPanel />
    </div>
  );
}
