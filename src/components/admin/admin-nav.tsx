"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
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
              "rounded-md px-2 py-1.5 transition-colors",
              FOCUS_BRAND_OUTLINE,
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
            className={cn(
              "rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
              FOCUS_BRAND_OUTLINE,
            )}
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
  /** Skip exit keep-mount so route skeleton isn't hidden under z-50 overlay. */
  const [skipExit, setSkipExit] = useState(false);
  if (open && skipExit) {
    setSkipExit(false);
  }
  const { present, exiting, animKey } = useExitPresence(
    open && !skipExit,
    QUOTE_PICKER_FLOAT_MS,
  );

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

  /** Animated dismiss (X, backdrop, Escape). */
  const close = () => setOpen(false);
  /** Nav: unmount instantly; Link still starts route transition same click. */
  const closeForNavigate = () => {
    setSkipExit(true);
    setOpen(false);
  };

  if (skipExit || !present) return null;

  return (
    <div className="admin-mobile-drawer-root fixed inset-0 z-50 print:hidden">
      <button
        type="button"
        aria-label="Cerrar menú"
        className={cn(
          "absolute inset-0 bg-black/40",
          exiting
            ? "admin-drawer-backdrop-exit pointer-events-none"
            : "admin-drawer-backdrop-enter",
        )}
        onClick={close}
        tabIndex={exiting ? -1 : undefined}
      />
      <aside
        key={animKey}
        id="admin-mobile-nav"
        role="dialog"
        aria-modal={exiting ? undefined : true}
        aria-hidden={exiting || undefined}
        aria-label="Menú de administración"
        className={cn(
          "relative h-full w-[min(100%,16rem)] overflow-y-auto border-r border-neutral-200 bg-white p-4 shadow-xl",
          exiting
            ? "admin-drawer-panel-exit pointer-events-none"
            : "admin-drawer-panel-enter",
        )}
      >
        <AdminSidebarPanel
          pathname={pathname}
          onNavigate={closeForNavigate}
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
      {/* Visibility via globals.css `.admin-desktop-sidebar` — not Tailwind `hidden lg:block`. */}
      <aside className="admin-desktop-sidebar rounded-lg border border-neutral-200 bg-white p-4 print:hidden">
        <AdminSidebarPanel pathname={pathname} />
      </aside>

      <AdminMobileDrawer pathname={pathname} />
    </>
  );
}
