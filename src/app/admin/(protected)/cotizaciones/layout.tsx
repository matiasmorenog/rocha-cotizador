import { CotizacionesRouteTransition } from "@/components/admin/cotizaciones-route-transition";

export default function CotizacionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CotizacionesRouteTransition>{children}</CotizacionesRouteTransition>;
}
