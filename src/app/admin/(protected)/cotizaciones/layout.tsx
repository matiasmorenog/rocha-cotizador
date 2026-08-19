import { CotizacionesRouteTransition } from "@/components/admin/cotizaciones-route-transition";
import { requireStaffPermission } from "@/lib/session";

export default async function CotizacionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffPermission("quotes");
  return <CotizacionesRouteTransition>{children}</CotizacionesRouteTransition>;
}
