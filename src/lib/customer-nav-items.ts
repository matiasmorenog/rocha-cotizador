import {
  ClipboardList,
  FileText,
  Home,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { customerStockTabsForModules } from "@/lib/customer-stock-shared";
import type { CustomerModuleSession } from "@/types/auth";

export type CustomerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  match: (pathname: string) => boolean;
};

function stockNavItem(modules: CustomerModuleSession[]): CustomerNavItem | null {
  const tabs = customerStockTabsForModules(modules);
  if (tabs.length === 0) return null;
  const href =
    tabs.length === 1 ? `/stock?tab=${tabs[0]!.tab}` : "/stock";

  return {
    href,
    label: "Stock",
    icon: Package,
    description: "Desperdicios, consumibles y activos del local.",
    match: (pathname) => pathname.startsWith("/stock"),
  };
}

export function buildCustomerNavItems(
  modules: CustomerModuleSession[],
): CustomerNavItem[] {
  const stock = stockNavItem(modules);

  return [
    {
      href: "/",
      label: "Inicio",
      icon: Home,
      description: "Accesos rápidos a las secciones de tu cuenta.",
      match: (pathname) => pathname === "/",
    },
    {
      href: "/cotizar",
      label: "Cotizar",
      icon: ClipboardList,
      description: "Armá una nueva cotización con tu lista de precios.",
      match: (path) => path.startsWith("/cotizar"),
    },
    {
      href: "/remitos",
      label: "Remitos",
      icon: FileText,
      description: "Consultá remitos anteriores y detalle de entregas.",
      match: (path) => path.startsWith("/remitos"),
    },
    ...(stock ? [stock] : []),
    {
      href: "/cuenta/configuracion",
      label: "Cuenta",
      icon: Settings,
      description: "Cambiá tu contraseña y datos de acceso.",
      match: (path) => path.startsWith("/cuenta"),
    },
  ];
}

/** Launcher cards on `/` — excludes Inicio. */
export function buildCustomerHomeActions(
  modules: CustomerModuleSession[],
): CustomerNavItem[] {
  return buildCustomerNavItems(modules).filter((item) => item.href !== "/");
}
