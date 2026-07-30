"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useRouteLoading } from "@/lib/route-loading-context";
import { cn } from "@/lib/utils";

/** Keep bar trickling at least this long after route change so fill is visible. */
const MIN_VISIBLE_AFTER_ROUTE_MS = 220;
const SKELETON_POLL_MS = 50;
const SKELETON_MAX_WAIT_MS = 8000;

function isSameRoute(
  pathname: string,
  search: string,
  target: URL,
): boolean {
  const current = pathname + (search ? `?${search}` : "");
  const next = target.pathname + target.search;
  return current === next;
}

function shouldStartNavigation(
  event: MouseEvent,
  anchor: HTMLAnchorElement,
  pathname: string,
  search: string,
): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target === "_blank") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  if (isSameRoute(pathname, search, url)) return false;

  return true;
}

function hasPendingSkeleton(): boolean {
  return Boolean(
    document.querySelector(
      'main [aria-busy="true"], main .rocha-skeleton, [role="status"][aria-busy="true"]',
    ),
  );
}

export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { overlayVisible, startLoading, finishLoading } = useRouteLoading();
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navStartedRef = useRef(false);
  const isFirstRouteRef = useRef(true);

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const beginNavigation = useCallback(() => {
    navStartedRef.current = true;
    startLoading();
  }, [startLoading]);

  const settleAfterRoute = useCallback(() => {
    clearSettle();
    if (!navStartedRef.current) return;

    const startedAt = Date.now();

    const tryFinish = () => {
      const elapsed = Date.now() - startedAt;
      const skeletonGone = !hasPendingSkeleton();
      const minTimeOk = elapsed >= MIN_VISIBLE_AFTER_ROUTE_MS;
      const timedOut = elapsed >= SKELETON_MAX_WAIT_MS;

      if ((skeletonGone && minTimeOk) || timedOut) {
        clearSettle();
        navStartedRef.current = false;
        finishLoading();
      }
    };

    // Let loading.tsx mount before first check.
    settleTimerRef.current = setTimeout(() => {
      tryFinish();
      pollRef.current = setInterval(tryFinish, SKELETON_POLL_MS);
    }, 32);
  }, [clearSettle, finishLoading]);

  useEffect(() => {
    if (isFirstRouteRef.current) {
      isFirstRouteRef.current = false;
      return;
    }
    settleAfterRoute();
  }, [pathname, search, settleAfterRoute]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor) return;
      if (!shouldStartNavigation(event, anchor, pathname, search)) return;
      beginNavigation();
    };

    const onPopState = () => beginNavigation();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearSettle();
    };
  }, [pathname, search, beginNavigation, clearSettle]);

  if (!overlayVisible) return null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[200] cursor-wait touch-none",
          "bg-white/20 backdrop-blur-[2px]",
          "route-loading-enter",
        )}
        aria-hidden
      />
      <p className="sr-only" role="status" aria-live="polite">
        Cargando página…
      </p>
    </>
  );
}
