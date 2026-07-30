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
  SkeletonListPage,
  SkeletonLoginPage,
  SkeletonQuotePage,
  SkeletonRemitoDetailPage,
} from "@/components/ui/skeleton";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

function customerSkeletonFor(path: string) {
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
  if (path.startsWith("/login") || path.startsWith("/entrar")) {
    return <SkeletonLoginPage />;
  }
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
  if (path === "/admin" || path === "/admin/") {
    return <SkeletonAdminDashboardPage />;
  }
  return <SkeletonAdminDashboardPage />;
}

type RoutePendingShellProps = {
  children: ReactNode;
  variant: "admin" | "customer";
};

/**
 * On soft-nav start (`pending`), cover children with a destination skeleton
 * immediately — do not wait for Next `loading.tsx` to swap the segment.
 *
 * Overlay bleeds out of root `main` padding (`px-4 py-6`) so one solid cream
 * surface meets the header edge-to-edge — no inset panel over body radials.
 */
export function RoutePendingShell({ children, variant }: RoutePendingShellProps) {
  const { pending, pendingPath } = useRouteLoading();
  const pathname = usePathname();
  const path = pendingPath ?? pathname;
  const skeleton =
    variant === "admin" ? adminSkeletonFor(path) : customerSkeletonFor(path);

  return (
    <div className={cn("relative", pending && "min-h-[12rem]")}>
      <div
        className={cn(pending && "invisible pointer-events-none select-none")}
        aria-hidden={pending || undefined}
        {...(pending ? { inert: true } : {})}
      >
        {children}
      </div>
      {pending ? (
        <div
          data-route-pending=""
          className="absolute -inset-x-4 -inset-y-6 z-[5] cursor-wait overflow-auto bg-[var(--background)] px-4 py-6"
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label="Cargando página"
        >
          {skeleton}
        </div>
      ) : null}
    </div>
  );
}
