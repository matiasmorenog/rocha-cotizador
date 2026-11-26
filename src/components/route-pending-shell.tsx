"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
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
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { customerModuleChromeForPath } from "@/lib/customer-module-chrome";
import {
  isAuthSessionSurfaceNav,
} from "@/lib/customer-module-path";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

function withModuleChrome(
  path: string,
  body: ReactNode,
  variant: "admin" | "customer",
): ReactNode {
  const chrome =
    variant === "admin"
      ? adminModuleChromeForPath(path)
      : customerModuleChromeForPath(path);
  if (!chrome) return body;
  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={chrome.description}
        titleClassName={
          path.startsWith("/admin/stock") ||
          path.startsWith("/admin/desperdicios") ||
          path.startsWith("/admin/consumibles") ||
          path.startsWith("/admin/mermas")
            ? "text-xl font-semibold text-neutral-900"
            : undefined
        }
      />
      {body}
    </div>
  );
}

function customerSkeletonFor(path: string, isGuest: boolean) {
  /** Live sidebar sits outside pending — skeleton content column only. */
  const withShell = false;

  if (path === "/" || path === "") {
    return isGuest ? <SkeletonChooserPage /> : <SkeletonHomePage />;
  }
  if (path.startsWith("/cotizar")) {
    return withModuleChrome(
      path,
      <SkeletonQuotePage withShell={withShell} />,
      "customer",
    );
  }
  if (path.startsWith("/remitos/") && path !== "/remitos") {
    return <SkeletonRemitoDetailPage withShell={withShell} />;
  }
  if (path.startsWith("/remitos")) {
    return withModuleChrome(
      path,
      <SkeletonCustomerRemitosPage withShell={withShell} />,
      "customer",
    );
  }
  if (path.startsWith("/stock")) {
    return withModuleChrome(
      path,
      <SkeletonCustomerStockPage withShell={withShell} />,
      "customer",
    );
  }
  if (path.startsWith("/cuenta")) {
    return withModuleChrome(
      path,
      <SkeletonCustomerCuentaConfigPage withShell={withShell} />,
      "customer",
    );
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
  if (path.startsWith("/entrar")) return <SkeletonChooserPage />;
  if (path.startsWith("/login")) return <SkeletonLoginPage />;
  if (path.startsWith("/admin/login")) {
    return <SkeletonLoginPage title="Cargando acceso admin" />;
  }
  if (path.startsWith("/admin/clientes")) {
    return withModuleChrome(
      path,
      <SkeletonAdminListPage label="Cargando clientes" />,
      "admin",
    );
  }
  if (path.startsWith("/admin/productos")) {
    return withModuleChrome(
      path,
      <SkeletonAdminListPage label="Cargando productos" />,
      "admin",
    );
  }
  if (path.startsWith("/admin/listas-precios")) {
    return withModuleChrome(path, <SkeletonAdminPriceListsPage />, "admin");
  }
  if (path.startsWith("/admin/cotizaciones/nueva")) {
    return withModuleChrome(path, <SkeletonAdminNewQuotePage />, "admin");
  }
  if (path.startsWith("/admin/cotizaciones")) {
    return withModuleChrome(path, <SkeletonAdminQuotesPage />, "admin");
  }
  if (path.startsWith("/admin/configuracion")) {
    return withModuleChrome(path, <SkeletonAdminConfigPage />, "admin");
  }
  if (
    path.startsWith("/admin/stock") ||
    path.startsWith("/admin/desperdicios") ||
    path.startsWith("/admin/consumibles") ||
    path.startsWith("/admin/mermas")
  ) {
    return withModuleChrome(path, <SkeletonAdminStockPage />, "admin");
  }
  if (path.startsWith("/admin/usuarios")) {
    return withModuleChrome(
      path,
      <SkeletonAdminListPage label="Cargando usuarios" />,
      "admin",
    );
  }
  if (path.startsWith("/admin/plataforma")) {
    return withModuleChrome(path, <SkeletonAdminPriceListsPage />, "admin");
  }
  if (path === "/admin" || path === "/admin/") {
    return withModuleChrome(path, <SkeletonAdminDashboardPage />, "admin");
  }
  return withModuleChrome(path, <SkeletonAdminDashboardPage />, "admin");
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
  const { data: session, status } = useSession();
  const path = pendingPath ?? pathname;
  const isGuest = status !== "loading" && !session?.user;
  /** Auth / guest landing — card stays mounted; skip skeleton cover. */
  const authSessionNav =
    pending &&
    pendingPath != null &&
    isAuthSessionSurfaceNav(pathname, pendingPath, isGuest);
  const showPendingOverlay = pending && !suppressOverlay && !authSessionNav;
  const hideContent = pending && !authSessionNav;
  const skeleton =
    variant === "admin"
      ? adminSkeletonFor(path)
      : customerSkeletonFor(path, isGuest);

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
        className={cn(hideContent && "hidden")}
        aria-hidden={hideContent || undefined}
        {...(hideContent ? { inert: true } : {})}
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
