"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  SkeletonAccountPage,
  SkeletonAdminConfigPage,
  SkeletonAdminDashboardPage,
  SkeletonAdminListPage,
  SkeletonAdminNewQuotePage,
  SkeletonAdminPriceListsPage,
  SkeletonAdminQuotesPage,
  SkeletonAdminStockPage,
  SkeletonChooserPage,
  SkeletonHomePage,
  SkeletonListPage,
  SkeletonLoginPage,
  SkeletonQuotePage,
  SkeletonRemitoDetailPage,
} from "@/components/ui/skeleton";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

function customerSkeletonFor(path: string) {
  if (path === "/" || path === "") return <SkeletonHomePage />;
  if (path.startsWith("/cotizar")) return <SkeletonQuotePage />;
  if (path.startsWith("/remitos/") && path !== "/remitos") {
    return <SkeletonRemitoDetailPage />;
  }
  if (path.startsWith("/remitos")) {
    return (
      <SkeletonListPage
        label="Cargando remitos"
        titleWidth="w-36"
        cols={4}
        descriptionWidth={null}
      />
    );
  }
  if (path.startsWith("/cuenta")) return <SkeletonAccountPage />;
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
 * Customer: full-bleed `.brand-page-atmosphere` (fixed) covers viewport gutters
 * outside `main.max-w-6xl`. Opaque bg only on the main column left a sharp
 * vertical edge where body wheat/latte radials showed on the right (remito
 * skeleton). Admin keeps column-local solid bg so the desktop sidebar stays
 * visible under a fixed layer. Do not paint a flat --background slab on the
 * overlay — body uses radial washes; a solid fill reads as a contrasting box.
 */
export function RoutePendingShell({
  children,
  variant,
  coverGutters = true,
}: RoutePendingShellProps) {
  const { pending, pendingPath } = useRouteLoading();
  const pathname = usePathname();
  const path = pendingPath ?? pathname;
  const showPendingOverlay = pending && pendingPath !== pathname;
  const skeleton =
    variant === "admin" ? adminSkeletonFor(path) : customerSkeletonFor(path);

  return (
    <div className={cn("relative min-w-0", showPendingOverlay && "min-h-[12rem]")}>
      <div
        className={cn(
          showPendingOverlay && "invisible pointer-events-none select-none",
        )}
        aria-hidden={showPendingOverlay || undefined}
        {...(showPendingOverlay ? { inert: true } : {})}
      >
        {children}
      </div>
      {showPendingOverlay ? (
        <>
          {variant === "customer" ? (
            <div
              aria-hidden
              className="brand-page-atmosphere pointer-events-none fixed inset-0 z-[4] print:hidden"
            />
          ) : null}
          <div
            data-route-pending=""
            className={cn(
              "absolute z-[5] cursor-wait overflow-auto",
              coverGutters
                ? "-inset-x-4 -inset-y-6 px-4 py-6"
                : "inset-0",
            )}
            role="status"
            aria-busy="true"
            aria-live="polite"
            aria-label="Cargando página"
          >
            {skeleton}
          </div>
        </>
      ) : null}
    </div>
  );
}
