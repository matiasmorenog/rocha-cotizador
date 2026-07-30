"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useRouteLoading } from "@/lib/route-loading-context";

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
  const nodes = document.querySelectorAll(
    'main [aria-busy="true"], main .rocha-skeleton, [role="status"][aria-busy="true"]',
  );
  for (const node of nodes) {
    // Ignore our instant cover — otherwise settle never finishes.
    if (node.closest("[data-route-pending]")) continue;
    return true;
  }
  return false;
}

/**
 * Soft-nav + initial hard-load trickle — no full-screen overlay/blur.
 * Progress lives in the header edge bar.
 */
export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { visible, startLoading, finishLoading } = useRouteLoading();
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

  const beginNavigation = useCallback(
    (path?: string | null) => {
      navStartedRef.current = true;
      startLoading(path);
    },
    [startLoading],
  );

  const settleAfterRoute = useCallback(() => {
    clearSettle();
    if (!navStartedRef.current) return;

    const startedAt = Date.now();

    const tryFinish = () => {
      const elapsed = Date.now() - startedAt;
      const skeletonGone = !hasPendingSkeleton();
      const docReady = document.readyState === "complete";
      const minTimeOk = elapsed >= MIN_VISIBLE_AFTER_ROUTE_MS;
      const timedOut = elapsed >= SKELETON_MAX_WAIT_MS;

      if ((skeletonGone && docReady && minTimeOk) || timedOut) {
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

  /** Hard refresh / first paint — soft-nav only listened to clicks before. */
  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let rafId = 0;

    const startInitialIfNeeded = () => {
      if (cancelled || navStartedRef.current) return true;
      const docStillLoading = document.readyState !== "complete";
      if (!docStillLoading && !hasPendingSkeleton()) return false;
      beginNavigation();
      settleAfterRoute();
      return true;
    };

    if (!startInitialIfNeeded()) {
      // loading.tsx / streaming may paint one frame after hydration.
      rafId = requestAnimationFrame(() => {
        if (startInitialIfNeeded()) return;
        const until = Date.now() + 120;
        pollId = setInterval(() => {
          if (startInitialIfNeeded() || Date.now() >= until) {
            if (pollId) clearInterval(pollId);
            pollId = null;
          }
        }, SKELETON_POLL_MS);
      });
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (pollId) clearInterval(pollId);
    };
  }, [beginNavigation, settleAfterRoute]);

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
      let nextPath: string | null = null;
      try {
        nextPath = new URL(anchor.href, window.location.href).pathname;
      } catch {
        nextPath = null;
      }
      beginNavigation(nextPath);
    };

    const onPopState = () => beginNavigation(window.location.pathname);

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearSettle();
    };
  }, [pathname, search, beginNavigation, clearSettle]);

  if (!visible) return null;

  return (
    <p className="sr-only" role="status" aria-live="polite">
      Cargando página…
    </p>
  );
}
