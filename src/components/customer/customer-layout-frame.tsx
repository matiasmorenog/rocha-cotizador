"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { CustomerNav } from "@/components/customer/customer-nav";
import { CustomerCatalogWarmup } from "@/components/customer/customer-catalog-warmup";
import { RoutePendingShell } from "@/components/route-pending-shell";
import { normalizeCustomerModules } from "@/lib/customer-modules-normalize";
import {
  isCustomerHomePath,
  isPublicAuthPath,
  shouldShowCustomerModuleShell,
} from "@/lib/customer-module-path";
import { useRouteLoading } from "@/lib/route-loading-context";
import { SkeletonHomePage } from "@/components/ui/skeleton";
import { isAdminPanelRole } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";
import type { CustomerModuleSession } from "@/types/auth";

function isAdminShellPath(path: string) {
  return path.startsWith("/admin") && !path.startsWith("/admin/login");
}

export type CustomerLayoutFrameUser = {
  modules: CustomerModuleSession[];
  userName?: string | null;
  customerCode?: string | null;
};

function resolveCustomerUser(
  bootstrap: CustomerLayoutFrameUser | null | undefined,
  session: ReturnType<typeof useSession>["data"],
  status: ReturnType<typeof useSession>["status"],
): CustomerLayoutFrameUser | null {
  if (
    session?.user?.role === "CUSTOMER" &&
    session.user.customerId
  ) {
    return {
      modules: normalizeCustomerModules(
        (session.user.modules ?? []).map(String),
      ),
      userName: session.user.name,
      customerCode: session.user.customerCode,
    };
  }
  if (status === "loading" && bootstrap) {
    return {
      modules: normalizeCustomerModules(bootstrap.modules.map(String)),
      userName: bootstrap.userName,
      customerCode: bootstrap.customerCode,
    };
  }
  return null;
}

/**
 * Customer nav stays mounted outside route pending — skeleton covers content only.
 * Same DOM shell on home and modules so the nav never remounts on Inicio → módulo.
 */
export function CustomerLayoutFrame({
  children,
  customerUser: bootstrap = null,
}: {
  children: ReactNode;
  customerUser?: CustomerLayoutFrameUser | null;
}) {
  const pathname = usePathname();
  const { pending, pendingPath } = useRouteLoading();
  const { data: session, status } = useSession();
  const dest = pendingPath ?? pathname;
  const moduleShell = shouldShowCustomerModuleShell(pathname, dest);
  const navigatingHome = pending && isCustomerHomePath(dest);

  if (isAdminShellPath(pathname)) {
    return <>{children}</>;
  }

  const customer = resolveCustomerUser(bootstrap, session, status);

  if (!customer) {
    const variant =
      isPublicAuthPath(dest) || isPublicAuthPath(pathname)
        ? "customer"
        : isAdminPanelRole(session?.user?.role)
          ? "admin"
          : "customer";
    return <RoutePendingShell variant={variant}>{children}</RoutePendingShell>;
  }

  const content = (
    <RoutePendingShell
      variant="customer"
      coverGutters={!moduleShell}
      suppressOverlay={navigatingHome}
    >
      {children}
    </RoutePendingShell>
  );

  return (
    <div className={cn("w-full", moduleShell && "admin-shell")}>
      <CustomerCatalogWarmup />
      <CustomerNav
        modules={customer.modules}
        userName={customer.userName}
        customerCode={customer.customerCode}
        showDesktopSidebar={moduleShell}
        activePathname={dest}
      />
      <div
        className={cn(
          "relative",
          moduleShell ? "min-w-0 flex-1" : "w-full",
        )}
      >
        {navigatingHome ? (
          <div data-route-pending="" className="relative z-[5]">
            <SkeletonHomePage />
          </div>
        ) : null}
        {content}
      </div>
    </div>
  );
}
