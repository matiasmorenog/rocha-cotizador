"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isPublicAuthPath } from "@/lib/customer-module-path";
import { useRouteLoading } from "@/lib/route-loading-context";
import { LoginCardShell } from "@/components/auth/login-session-shell";

export { useLoginShake, LOGIN_CARD_CLASS } from "@/components/auth/login-session-shell";

/** Standalone guest home card — auth routes use LoginSessionShell in `(auth)` layout. */
export function LoginCard({ children }: { children: ReactNode }) {
  const { pending, pendingPath } = useRouteLoading();
  const pathname = usePathname();
  const dest = pendingPath ?? pathname;
  const leavingAuth =
    pending &&
    isPublicAuthPath(pathname) &&
    !isPublicAuthPath(dest);

  return (
    <LoginCardShell enter={!pending} exit={leavingAuth}>
      {children}
    </LoginCardShell>
  );
}
