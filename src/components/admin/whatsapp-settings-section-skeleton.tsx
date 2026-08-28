import { Skeleton } from "@/components/ui/skeleton";

export function WhatsAppSettingsSectionSkeleton() {
  return (
    <div
      className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3"
      aria-busy="true"
      aria-label="Cargando WhatsApp"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-full" />
      <div className="mt-3 space-y-4">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}
