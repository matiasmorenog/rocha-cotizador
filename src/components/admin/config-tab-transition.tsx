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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseConfigTab } from "@/lib/admin-config-tabs";
import { cn } from "@/lib/utils";

/** Keep in sync with `.quote-route-exit` duration in globals.css */
const CONFIG_TAB_EXIT_MS = 200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollConfigTabToTop() {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

type ConfigTabCtx = {
  navigateWithExit: (href: string) => void;
  isExiting: boolean;
  routeKey: string;
};

const ConfigTabContext = createContext<ConfigTabCtx | null>(null);

function configTabRouteKey(pathname: string, tab: string) {
  return `${pathname}?tab=${tab}`;
}

/**
 * Scoped `?tab=` fade/slide (~200ms), same language as quote-route-enter/exit.
 * Exit delays soft nav so the outgoing panel can finish; enter runs on the new tab.
 */
export function ConfigTabTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseConfigTab(searchParams.get("tab") ?? undefined);
  const routeKey = configTabRouteKey(pathname, tab);
  const router = useRouter();
  const [exitTarget, setExitTarget] = useState<string | null>(null);
  const exitGenRef = useRef(0);
  const skipScrollOnMountRef = useRef(true);

  const isExiting = exitTarget !== null && exitTarget !== routeKey;

  const navigateWithExit = useCallback(
    (href: string) => {
      if (href === routeKey || isExiting) return;

      if (prefersReducedMotion()) {
        router.push(href);
        return;
      }

      setExitTarget(href);
    },
    [routeKey, isExiting, router],
  );

  useEffect(() => {
    if (!isExiting || !exitTarget) return;

    const gen = ++exitGenRef.current;
    const href = exitTarget;
    const t = window.setTimeout(() => {
      if (gen !== exitGenRef.current) return;
      router.push(href, { scroll: false });
    }, CONFIG_TAB_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [isExiting, exitTarget, router]);

  useEffect(() => {
    if (skipScrollOnMountRef.current) {
      skipScrollOnMountRef.current = false;
      return;
    }
    scrollConfigTabToTop();
  }, [routeKey]);

  return (
    <ConfigTabContext.Provider value={{ navigateWithExit, isExiting, routeKey }}>
      {children}
    </ConfigTabContext.Provider>
  );
}

/** Animated panel wrapper — tab bar stays outside this. */
export function ConfigTabPanel({ children }: { children: ReactNode }) {
  const ctx = useContext(ConfigTabContext);
  if (!ctx) return children;

  return (
    <div
      key={ctx.routeKey}
      className={cn(ctx.isExiting ? "quote-route-exit" : "quote-route-enter")}
    >
      {children}
    </div>
  );
}

/** Soft-nav tab link with exit animation when inside ConfigTabTransition. */
export function ConfigTabLink({
  href,
  className,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
}) {
  const ctx = useContext(ConfigTabContext);

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
