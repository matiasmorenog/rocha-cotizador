import { SkeletonAdminShellPage } from "@/components/ui/skeleton";

/**
 * Shows while `admin/(protected)/layout` awaits auth.
 * Generic shell — not dashboard-shaped (cotizaciones is the common landing).
 */
export default function AdminSegmentLoading() {
  return <SkeletonAdminShellPage />;
}
