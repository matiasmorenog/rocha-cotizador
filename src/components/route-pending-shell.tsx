"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { CustomerNav } from "@/components/customer/customer-nav";
import {
  SkeletonAdminConfigPage,
  SkeletonAdminDashboardPage,
  SkeletonAdminListPage,
  SkeletonAdminNewQuotePage,
  SkeletonAdminPriceListsPage,
  SkeletonAdminQuotesPage,
  SkeletonAdminStockPage,
  SkeletonChooserPage,
  SkeletonCustomerCuentaConfigPage,
  SkeletonCustomerRemitosPage,
  SkeletonCustomerStockPage,
  SkeletonHomePage,
  SkeletonListPage,
  SkeletonLoginPage,
  SkeletonQuotePage,
  SkeletonRemitoDetailPage,
} from "@/components/ui/skeleton";
import { normalizeCustomerModules } from "@/lib/customer-modules-normalize";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

function isCustomerModulePath(path: string): boolean {
  return (
    path.startsWith("/cotizar") ||
    path.startsWith("/remitos") ||
    path.startsWith("/stock") ||
    path.startsWith("/cuenta")
  );
}

function customerSkeletonFor(path: string) {
  /** Layout + JWT already know nav — never skeleton the sidebar on module routes. */
  const withShell = !isCustomerModulePath(path);

  if (path === "/" || path === "") return <SkeletonHomePage />;
  if (path.startsWith("/cotizar")) return <SkeletonQuotePage withShell={withShell} />;
  if (path.startsWith("/remitos/") && path !== "/remitos") {
    return <SkeletonRemitoDetailPage withShell={withShell} />;
  }
  if (path.startsWith("/remitos")) {
    return <SkeletonCustomerRemitosPage withShell={withShell} />;
  }
  if (path.startsWith("/stock")) {
    return <SkeletonCustomerStockPage withShell={withShell} />;
  }
  if (path.startsWith("/cuenta")) {
    return <SkeletonCustomerCuentaConfigPage withShell={withShell} />;
  }
  if (path.startsWith("/entrar")) return <SkeletonChooserPage />;
  if (path.startsWith("/login")) return <SkeletonLoginPage />;
  if (path.startsWith("/admin/login")) {
    return <SkeletonLoginPage title="Cargando acceso admin" />;
  }
  return (
    <SkeletonListPage
      label="Cargando página"
      titleWidth="w-40"
      descriptionWidth="w-56"
    />
  );
}

function adminSkeletonFor(path: string) {
  if (path.startsWith("/admin/clientes")) {
    return <SkeletonAdminListPage label="Cargando clientes" titleWidth="w-28" />;
  }
  if (path.startsWith("/admin/productos")) {
    return (
      <SkeletonAdminListPage label="Cargando productos" titleWidth="w-36" />
    );
  }
  if (path.startsWith("/admin/listas-precios")) {
    return <SkeletonAdminPriceListsPage />;
  }
  if (path.startsWith("/admin/cotizaciones/nueva")) {
    return <SkeletonAdminNewQuotePage />;
  }
  if (path.startsWith("/admin/cotizaciones")) {
    return <SkeletonAdminQuotesPage />;
  }
  if (path.startsWith("/admin/configuracion")) {
    return <SkeletonAdminConfigPage />;
  }
  if (path.startsWith("/admin/stock")) {
    return <SkeletonAdminStockPage />;
  }
  if (path.startsWith("/admin/usuarios")) {
    return <SkeletonAdminListPage label="Cargando usuarios" titleWidth="w-28" />;
  }
  if (path.startsWith("/admin/plataforma")) {
    return <SkeletonAdminPriceListsPage />;
  }
  if (path === "/admin" || path === "/admin/") {
    return <SkeletonAdminDashboardPage />;
  }
  return <SkeletonAdminDashboardPage />;
}

type RoutePendingShellProps = {
  children: ReactNode;
  variant: "admin" | "customer";
  /**
   * Cover parent padding (customer `main` is `px-4 py-6`). Admin content
   * column is already the page box — negative inset + extra pad clips the
   * table skeleton on `min-w-0` flex (remito → cotizaciones).
   */
  coverGutters?: boolean;
};

/**
 * On soft-nav start (`pending`), cover children with a destination skeleton
 * immediately — do not wait for Next `loading.tsx` to swap the segment.
 *
 * Customer modules: real sidebar from session (same items as home cards);
 * only the content column skeletons while the route resolves.
 */
export function RoutePendingShell({
  children,
  variant,
  coverGutters = true,
}: RoutePendingShellProps) {
  const { pending, pendingPath } = useRouteLoading();
  const pathname = usePathname();
  const { data: session } = useSession();
  const path = pendingPath ?? pathname;
  const showPendingOverlay = pending;
  const skeleton =
    variant === "admin" ? adminSkeletonFor(path) : customerSkeletonFor(path);

  const customerUser =
    session?.user?.role === "CUSTOMER" && session.user.customerId
      ? session.user
      : null;
  const showLiveCustomerNav =
    variant === "customer" &&
    showPendingOverlay &&
    customerUser != null &&
    isCustomerModulePath(path);

  const pendingOverlay = (
    <div
      data-route-pending=""
      className={cn(
        "cursor-wait overflow-auto",
        showLiveCustomerNav
          ? "relative min-h-[12rem] min-w-0 flex-1"
          : cn(
              "absolute z-[5]",
              coverGutters ? "-inset-x-4 -inset-y-6 px-4 py-6" : "inset-0",
            ),
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando página"
    >
      {skeleton}
    </div>
  );

  return (
    <div
      className={cn(
        "relative min-w-0 w-full",
        showPendingOverlay &&
          !showLiveCustomerNav &&
          "min-h-[min(calc(100vh-10rem),40rem)]",
      )}
    >
      <div
        className={cn(showPendingOverlay && "hidden")}
        aria-hidden={showPendingOverlay || undefined}
        {...(showPendingOverlay ? { inert: true } : {})}
      >
        {children}
      </div>
      {showPendingOverlay ? (
        <>
          {variant === "customer" && !showLiveCustomerNav ? (
            <div
              aria-hidden
              className="brand-page-atmosphere pointer-events-none fixed inset-0 z-[4] print:hidden"
            />
          ) : null}
          {showLiveCustomerNav ? (
            <div className="w-full admin-shell">
              <CustomerNav
                modules={normalizeCustomerModules(
                  (customerUser.modules ?? []).map(String),
                )}
                userName={customerUser.name}
                customerCode={customerUser.customerCode}
                activePathname={path}
                showDesktopSidebar
              />
              {pendingOverlay}
            </div>
          ) : (
            pendingOverlay
          )}
        </>
      ) : null}
    </div>
  );
}
