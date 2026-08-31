import { SkeletonConfigNestedCard } from "@/components/ui/skeleton";

export function WhatsAppSettingsSectionSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando WhatsApp">
      <SkeletonConfigNestedCard
        titleWidth="w-24"
        descLines={1}
        fields={1}
        submitButton
      />
    </div>
  );
}
