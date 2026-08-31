"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, Package, Settings } from "lucide-react";
import { customerStockTabsForModules } from "@/lib/customer-stock-shared";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import type { CustomerModuleSession } from "@/types/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof ClipboardList;
  match: (pathname: string) => boolean;
};

function stockNavItem(modules: CustomerModuleSession[]): NavItem | null {
  if (modules.length === 0) return null;
  const tabs = customerStockTabsForModules(modules);
  const href =
    tabs.length === 1
      ? `/stock?tab=${tabs[0]!.tab}`
      : "/stock";

  return {
    href,
    label: "Stock",
    icon: Package,
    match: (pathname) => pathname.startsWith("/stock"),
  };
}

export function CustomerNav({
  modules,
}: {
  modules: CustomerModuleSession[];
}) {
  const pathname = usePathname();
  const stock = stockNavItem(modules);

  const items: NavItem[] = [
    {
      href: "/cotizar",
      label: "Cotizar",
      icon: ClipboardList,
      match: (path) => path.startsWith("/cotizar"),
    },
    {
      href: "/remitos",
      label: "Remitos",
      icon: FileText,
      match: (path) => path.startsWith("/remitos"),
    },
    ...(stock ? [stock] : []),
    {
      href: "/cuenta/configuracion",
      label: "Cuenta",
      icon: Settings,
      match: (path) => path.startsWith("/cuenta"),
    },
  ];

  return (
    <nav
      aria-label="Secciones del cliente"
      className={cn(
        "flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--brand-primary)]/15 bg-white/80 p-1 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              FOCUS_BRAND_OUTLINE,
              active
                ? "bg-[var(--brand-primary)] text-white shadow-sm"
                : "text-neutral-700 hover:bg-[var(--brand-primary-soft)]/60 hover:text-[var(--brand-primary)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
