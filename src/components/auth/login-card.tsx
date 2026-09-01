"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { isPublicAuthPath } from "@/lib/customer-module-path";
import { useRouteLoading } from "@/lib/route-loading-context";
import { LoginCardShell } from "@/components/auth/login-session-shell";

export { useLoginShake, LOGIN_CARD_CLASS } from "@/components/auth/login-session-shell";

/** Standalone guest home card — auth routes use LoginSessionShell in `(auth)` layout. */
export function LoginCard({ children }: { children: ReactNode }) {
  const { pending, pendingPath } = useRouteLoading();
  const pathname = usePathname();
  const dest = pendingPath ?? pathname;
  const isClient = useIsClient();
  const [cardEnter] = useState(true);

  const leavingAuth =
    isClient &&
    pending &&
    isPublicAuthPath(pathname) &&
    !isPublicAuthPath(dest);

  return (
    <LoginCardShell
      enter={isClient && cardEnter && !pending && !leavingAuth}
      exit={leavingAuth}
    >
      {children}
    </LoginCardShell>
  );
}
