"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

function customerSkeletonFor(path: string) {
  /** Live sidebar sits outside pending — skeleton content column only. */
  const withShell = false;

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
  /** Home hub uses a full-width skeleton in CustomerLayoutFrame instead. */
  suppressOverlay?: boolean;
};

/**
 * On soft-nav start (`pending`), cover children with a destination skeleton
 * immediately — do not wait for Next `loading.tsx` to swap the segment.
 *
 * Customer module routes: live nav is outside this shell — content skeleton only.
 */
export function RoutePendingShell({
  children,
  variant,
  coverGutters = true,
  suppressOverlay = false,
}: RoutePendingShellProps) {
  const { pending, pendingPath } = useRouteLoading();
  const pathname = usePathname();
  const path = pendingPath ?? pathname;
  const showPendingOverlay = pending && !suppressOverlay;
  const skeleton =
    variant === "admin" ? adminSkeletonFor(path) : customerSkeletonFor(path);

  const pendingOverlay = (
    <div
      data-route-pending=""
      className={cn(
        "relative z-[5] cursor-wait",
        coverGutters && "-mx-4 -my-6 px-4 py-6",
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
    <div className="relative min-w-0 w-full">
      <div
        data-route-content=""
        className={cn(pending && "hidden")}
        aria-hidden={pending || undefined}
        {...(pending ? { inert: true } : {})}
      >
        {children}
      </div>
      {showPendingOverlay ? (
        <>
          {variant === "customer" && coverGutters ? (
            <div
              aria-hidden
              className="brand-page-atmosphere pointer-events-none fixed inset-0 z-[4] print:hidden"
            />
          ) : null}
          {pendingOverlay}
        </>
      ) : null}
    </div>
  );
}
