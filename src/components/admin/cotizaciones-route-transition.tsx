"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Keep in sync with `.quote-route-exit` duration in globals.css */
const QUOTE_ROUTE_EXIT_MS = 200;

type CotizacionesRouteCtx = {
  navigateWithExit: (href: string) => void;
};

const CotizacionesRouteContext = createContext<CotizacionesRouteCtx | null>(
  null,
);

/**
 * Scoped list ↔ nueva fade/slide (~200ms), same language as quote-panel-enter.
 * Exit delays soft nav so the outgoing page can finish; enter runs on the new page.
 */
export function CotizacionesRouteTransition({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [exitTarget, setExitTarget] = useState<string | null>(null);
  const exitGenRef = useRef(0);

  /** True only while waiting to leave current pathname for exitTarget. */
  const isExiting = exitTarget !== null && exitTarget !== pathname;

  const navigateWithExit = useCallback(
    (href: string) => {
      if (href === pathname || isExiting) return;

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        router.push(href);
        return;
      }

      setExitTarget(href);
    },
    [pathname, isExiting, router],
  );

  useEffect(() => {
    if (!isExiting || !exitTarget) return;

    const gen = ++exitGenRef.current;
    const href = exitTarget;
    const t = window.setTimeout(() => {
      if (gen !== exitGenRef.current) return;
      router.push(href);
    }, QUOTE_ROUTE_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [isExiting, exitTarget, router]);

  return (
    <CotizacionesRouteContext.Provider value={{ navigateWithExit }}>
      <div
        key={pathname}
        className={cn(isExiting && "quote-route-exit")}
      >
        {children}
      </div>
    </CotizacionesRouteContext.Provider>
  );
}

/** Soft-nav Link with exit animation when inside CotizacionesRouteTransition. */
export function CotizacionesTransitionLink({
  href,
  className,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
}) {
  const ctx = useContext(CotizacionesRouteContext);

  if (!ctx) {
    return (
      <Link href={href} className={className} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        ctx.navigateWithExit(href);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
