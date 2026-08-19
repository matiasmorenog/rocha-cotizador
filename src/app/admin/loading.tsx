import { SkeletonAdminDashboardPage } from "@/components/ui/skeleton";

/**
 * Shows while `admin/(protected)/layout` awaits auth.
 * Nested `(protected)/loading.tsx` cannot paint until that layout resolves.
 */
export default function AdminSegmentLoading() {
  return <SkeletonAdminDashboardPage />;
}
