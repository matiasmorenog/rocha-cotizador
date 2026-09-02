import { Skeleton } from "@/components/ui/skeleton";

export function OrderCutoffSettingsSectionSkeleton() {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
      <Skeleton className="mb-2 h-4 w-36" />
      <Skeleton className="mb-3 h-3 w-full max-w-md" />
      <Skeleton className="h-10 w-full max-w-xs rounded-md" />
    </div>
  );
}
