"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import { buildCustomerNavItems } from "@/lib/customer-nav-items";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { useCustomerNavStore } from "@/stores/customer-nav-store";
import type { CustomerModuleSession } from "@/types/auth";
import { cn } from "@/lib/utils";

function CustomerSidebarUserInfo({
  userName,
  customerCode,
}: {
  userName?: string | null;
  customerCode?: string | null;
}) {
  const primary = userName?.trim() || "Cliente";
  const code = customerCode?.trim();

  return (
    <div className="mb-3 border-b border-neutral-200 pb-3">
      <p className="truncate text-sm font-medium text-neutral-900">{primary}</p>
      {code ? (
        <p className="truncate text-xs text-neutral-500">Código {code}</p>
      ) : null}
    </div>
  );
}

function NavLinks({
  pathname,
  modules,
  onNavigate,
}: {
  pathname: string;
  modules: CustomerModuleSession[];
  onNavigate?: () => void;
}) {
  const items = buildCustomerNavItems(modules);

  return (
    <nav
      aria-label="Secciones del cliente"
      className="flex flex-col gap-1 text-sm"
    >
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
              FOCUS_BRAND_OUTLINE,
              active
                ? "bg-[var(--brand-primary-soft)] font-medium text-[var(--brand-primary)]"
                : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function CustomerSidebarPanel({
  pathname,
  modules,
  onNavigate,
  showCloseButton = false,
  onClose,
  userName,
  customerCode,
}: {
  pathname: string;
  modules: CustomerModuleSession[];
  onNavigate?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  userName?: string | null;
  customerCode?: string | null;
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
      <CustomerSidebarUserInfo
        userName={userName}
        customerCode={customerCode}
      />
      <NavLinks
        pathname={pathname}
        modules={modules}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function CustomerMobileDrawer({
  pathname,
  modules,
  userName,
  customerCode,
}: {
  pathname: string;
  modules: CustomerModuleSession[];
  userName?: string | null;
  customerCode?: string | null;
}) {
  const open = useCustomerNavStore((s) => s.open);
  const setOpen = useCustomerNavStore((s) => s.setOpen);
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
        id="customer-mobile-nav"
        role="dialog"
        aria-modal={exiting ? undefined : true}
        aria-hidden={exiting || undefined}
        aria-label="Menú del cliente"
        className={cn(
          "relative h-full w-[min(100%,16rem)] overflow-y-auto border-r border-neutral-200 bg-white p-4 shadow-xl",
          exiting
            ? "admin-drawer-panel-exit pointer-events-none"
            : "admin-drawer-panel-enter",
        )}
      >
        <CustomerSidebarPanel
          pathname={pathname}
          modules={modules}
          onNavigate={closeForNavigate}
          showCloseButton
          onClose={close}
          userName={userName}
          customerCode={customerCode}
        />
      </aside>
    </div>
  );
}

export function CustomerNav({
  modules,
  userName,
  customerCode,
  showDesktopSidebar = true,
}: {
  modules: CustomerModuleSession[];
  userName?: string | null;
  customerCode?: string | null;
  /** Home hub uses full-width centering; drawer still available on mobile. */
  showDesktopSidebar?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      {showDesktopSidebar ? (
        <aside className="admin-desktop-sidebar rounded-lg border border-neutral-200 bg-white p-4 shadow-sm print:hidden">
          <CustomerSidebarPanel
            pathname={pathname}
            modules={modules}
            userName={userName}
            customerCode={customerCode}
          />
        </aside>
      ) : null}

      <CustomerMobileDrawer
        pathname={pathname}
        modules={modules}
        userName={userName}
        customerCode={customerCode}
      />
    </>
  );
}
