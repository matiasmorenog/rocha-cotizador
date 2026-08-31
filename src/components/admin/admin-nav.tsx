"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  UserCog,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import { StaffPreviewControl } from "@/components/admin/staff-preview-ui";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import type { StaffPermission } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";
import { useAdminNavStore } from "@/stores/admin-nav-store";

const links: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  permission: StaffPermission;
}> = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    permission: "dashboard",
  },
  { href: "/admin/clientes", label: "Clientes", icon: Users, permission: "customers" },
  { href: "/admin/productos", label: "Productos", icon: Package, permission: "products" },
  {
    href: "/admin/listas-precios",
    label: "Listas de precios",
    icon: Tags,
    permission: "priceLists",
  },
  {
    href: "/admin/cotizaciones",
    label: "Cotizaciones",
    icon: ClipboardList,
    permission: "quotes",
  },
  { href: "/admin/stock", label: "Stock", icon: Warehouse, permission: "stockReports" },
  { href: "/admin/usuarios", label: "Usuarios", icon: UserCog, permission: "users" },
  {
    href: "/admin/configuracion",
    label: "Configuración",
    icon: Settings,
    permission: "account",
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  onNavigate,
  permissions,
}: {
  pathname: string;
  onNavigate?: () => void;
  permissions: StaffPermission[];
}) {
  const filtered = links.filter((l) => permissions.includes(l.permission));

  return (
    <nav
      aria-label="Navegación de administración"
      className="flex flex-col gap-1 text-sm"
    >
      {filtered.map((l) => {
        const active = isActive(
          pathname,
          l.href,
          "exact" in l ? l.exact : false,
        );
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className={cn(
              "admin-nav-link inline-flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
              FOCUS_BRAND_OUTLINE,
              active
                ? "admin-nav-link-active bg-[var(--brand-primary-soft)] font-medium text-[var(--brand-primary)]"
                : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdminSidebarUserInfo({
  name,
  email,
  isSuperuser,
}: {
  name?: string | null;
  email?: string | null;
  isSuperuser?: boolean;
}) {
  const primary = name?.trim() || email?.trim() || "Usuario";
  const showEmailSecondary = Boolean(name?.trim() && email?.trim());

  return (
    <div className="mb-3 border-b border-neutral-200 pb-3">
      <p className="truncate text-sm font-medium text-neutral-900">{primary}</p>
      {showEmailSecondary ? (
        <p className="truncate text-xs text-neutral-500">{email}</p>
      ) : null}
      {isSuperuser ? (
        <div className="mt-2">
          <StaffPreviewControl isSuperuser />
        </div>
      ) : null}
    </div>
  );
}

function AdminSidebarPanel({
  pathname,
  onNavigate,
  showCloseButton = false,
  onClose,
  permissions,
  userName,
  userEmail,
  isSuperuser,
}: {
  pathname: string;
  onNavigate?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  permissions: StaffPermission[];
  userName?: string | null;
  userEmail?: string | null;
  isSuperuser?: boolean;
}) {
  return (
    <div className="flex h-auto flex-col">
      {showCloseButton ? (
        <div className="mb-3 flex justify-end">
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
        </div>
      ) : null}
      <AdminSidebarUserInfo
        name={userName}
        email={userEmail}
        isSuperuser={isSuperuser}
      />
      <NavLinks
        pathname={pathname}
        onNavigate={onNavigate}
        permissions={permissions}
      />
    </div>
  );
}

function AdminMobileDrawer({
  pathname,
  permissions,
  userName,
  userEmail,
  isSuperuser,
}: {
  pathname: string;
  permissions: StaffPermission[];
  userName?: string | null;
  userEmail?: string | null;
  isSuperuser?: boolean;
}) {
  const open = useAdminNavStore((s) => s.open);
  const setOpen = useAdminNavStore((s) => s.setOpen);
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

  const close = () => setOpen(false);
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
          permissions={permissions}
          userName={userName}
          userEmail={userEmail}
          isSuperuser={isSuperuser}
        />
      </aside>
    </div>
  );
}

export function AdminNav({
  permissions,
  userName,
  userEmail,
  isSuperuser,
}: {
  permissions: StaffPermission[];
  userName?: string | null;
  userEmail?: string | null;
  isSuperuser?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      <aside className="admin-desktop-sidebar rounded-lg border border-neutral-200 bg-white p-4 shadow-sm print:hidden">
        <AdminSidebarPanel
          pathname={pathname}
          permissions={permissions}
          userName={userName}
          userEmail={userEmail}
          isSuperuser={isSuperuser}
        />
      </aside>

      <AdminMobileDrawer
        pathname={pathname}
        permissions={permissions}
        userName={userName}
        userEmail={userEmail}
        isSuperuser={isSuperuser}
      />
    </>
  );
}
