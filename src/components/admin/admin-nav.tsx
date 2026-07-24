"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminNavStore } from "@/stores/admin-nav-store";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/listas-precios", label: "Listas de precios" },
  { href: "/admin/cotizaciones", label: "Cotizaciones" },
  { href: "/admin/configuracion", label: "Configuración" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegación de administración" className="flex flex-col gap-1 text-sm">
      {links.map((l) => {
        const active = isActive(pathname, l.href, "exact" in l ? l.exact : false);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className={cn(
              "rounded-md px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1",
              active
                ? "bg-[var(--brand-primary-soft)] font-medium text-[var(--brand-primary)]"
                : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminSidebarPanel({
  pathname,
  onNavigate,
  showCloseButton = false,
  onClose,
}: {
  pathname: string;
  onNavigate?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-auto flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Administración
        </p>
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      <NavLinks pathname={pathname} onNavigate={onNavigate} />
    </div>
  );
}

function AdminMobileDrawer({ pathname }: { pathname: string }) {
  const open = useAdminNavStore((s) => s.open);
  const setOpen = useAdminNavStore((s) => s.setOpen);

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const close = () => setOpen(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden print:hidden">
      <button
        type="button"
        aria-label="Cerrar menú"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <aside
        id="admin-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de administración"
        className="relative h-full w-[min(100%,16rem)] overflow-y-auto border-r border-neutral-200 bg-white p-4 shadow-xl"
      >
        <AdminSidebarPanel
          pathname={pathname}
          onNavigate={close}
          showCloseButton
          onClose={close}
        />
      </aside>
    </div>
  );
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="sticky top-6 hidden h-fit w-56 shrink-0 self-start rounded-lg border border-neutral-200 bg-white p-4 print:hidden lg:block">
        <AdminSidebarPanel pathname={pathname} />
      </aside>

      <AdminMobileDrawer pathname={pathname} />
    </>
  );
}
