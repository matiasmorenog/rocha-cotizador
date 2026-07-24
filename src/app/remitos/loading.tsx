import { SkeletonListPage } from "@/components/ui/skeleton";

export default function RemitosLoading() {
  return (
    <SkeletonListPage
      label="Cargando remitos"
      titleWidth="w-36"
      cols={4}
      descriptionWidth={null}
    />
  );
}
