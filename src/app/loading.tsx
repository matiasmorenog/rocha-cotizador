import { SkeletonListPage } from "@/components/ui/skeleton";

/** Neutral fallback — never the home/login card (that flashed on remito → admin). */
export default function RootLoading() {
  return (
    <SkeletonListPage
      label="Cargando página"
      titleWidth="w-40"
      descriptionWidth="w-56"
    />
  );
}
