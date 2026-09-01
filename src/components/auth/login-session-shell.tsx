"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { isPublicAuthPath } from "@/lib/customer-module-path";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

export const LOGIN_CARD_CLASS =
  "w-full space-y-6 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]/95 p-6 shadow-sm backdrop-blur-[2px]";

const LoginShakeContext = createContext<{ shake: () => void } | null>(null);

export function useLoginShake() {
  const ctx = useContext(LoginShakeContext);
  return ctx ?? { shake: () => {} };
}

/** Card chrome + shake — used by session shell and standalone guest home. */
export function LoginCardShell({
  children,
  className,
  enter = false,
  exit = false,
}: {
  children: ReactNode;
  className?: string;
  enter?: boolean;
  exit?: boolean;
}) {
  const [shaking, setShaking] = useState(false);
  const shake = useCallback(() => setShaking(true), []);
  const stopShaking = useCallback((e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName !== "login-shake") return;
    setShaking(false);
  }, []);

  return (
    <LoginShakeContext.Provider value={{ shake }}>
      <div
        className={cn(
          LOGIN_CARD_CLASS,
          enter && "login-card-enter",
          exit && "login-card-exit",
          shaking && "login-shake",
          className,
        )}
        onAnimationEnd={stopShaking}
      >
        {children}
      </div>
    </LoginShakeContext.Provider>
  );
}

let loginSessionShellEntered = false;

function LoginSessionContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const syncHeight = () => {
      outer.style.height = `${inner.offsetHeight}px`;
    };

    syncHeight();
    const ro = new ResizeObserver(syncHeight);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [pathname, children]);

  return (
    <div ref={outerRef} className="login-session-height overflow-hidden">
      <div
        ref={innerRef}
        key={pathname}
        className="login-session-pane space-y-6"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Persistent auth card for /entrar, /login, /admin/login — logo stays mounted;
 * inner content crossfades and card height eases on route change.
 */
export function LoginSessionShell({ children }: { children: ReactNode }) {
  const { pending, pendingPath } = useRouteLoading();
  const pathname = usePathname();
  const dest = pendingPath ?? pathname;
  const [cardEnter] = useState(() => {
    if (loginSessionShellEntered) return false;
    loginSessionShellEntered = true;
    return true;
  });

  const leavingAuth =
    pending &&
    isPublicAuthPath(pathname) &&
    !isPublicAuthPath(dest);

  return (
    <LoginCardShell enter={cardEnter && !leavingAuth} exit={leavingAuth}>
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandLogo size="xl" priority />
      </div>
      <LoginSessionContent>{children}</LoginSessionContent>
    </LoginCardShell>
  );
}
