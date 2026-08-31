"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { isCustomerHomePath } from "@/lib/customer-module-path";
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

/** Same pathname, different query — layout/tabs stay; page slot uses loading.tsx. */
function isQueryOnlyNavigation(pathname: string, target: URL): boolean {
  return target.pathname === pathname;
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
  // Route loading boundaries only — not in-page busy UI (e.g. product picker
  // aria-busy while catalog revalidates would keep the nav cover up for seconds).
  const nodes = document.querySelectorAll(
    "main .rocha-skeleton, main [role=\"status\"][aria-busy=\"true\"]",
  );
  for (const node of nodes) {
    // Our overlay + layout home skeleton while pending.
    if (node.closest("[data-route-pending]")) continue;
    // Next loading.tsx under hidden route children — not user-visible.
    if (node.closest(".hidden")) continue;
    return true;
  }
  return false;
}

/** Segment loading.tsx still mounted under hidden route content. */
function hasHiddenRouteSkeleton(): boolean {
  const hidden = document.querySelector("[data-route-content].hidden");
  if (!hidden) return false;
  return (
    hidden.querySelector(
      ".rocha-skeleton, [role=\"status\"][aria-busy=\"true\"]",
    ) != null
  );
}

/**
 * Soft-nav + initial hard-load trickle — no full-screen overlay/blur.
 * Progress lives in the header edge bar.
 */
export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const {
    visible,
    pending,
    pendingPath,
    startLoading,
    finishLoading,
    reconcilePendingPath,
    isNavActive,
  } = useRouteLoading();
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navStartedRef = useRef(false);
  const isFirstRouteRef = useRef(true);
  const pathnameRef = useRef(pathname);
  const pendingPathRef = useRef(pendingPath);
  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    pendingPathRef.current = pendingPath;
  }, [pathname, pendingPath]);

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
    // Link clicks set navStartedRef. Programmatic startLoading (Volver
    // button) only flips context activeRef — still must settle or the
    // admin cover never dismisses.
    if (!navStartedRef.current && !isNavActive()) return;
    navStartedRef.current = true;

    const startedAt = Date.now();

    const tryFinish = () => {
      const elapsed = Date.now() - startedAt;
      const skeletonGone = !hasPendingSkeleton();
      const routeContentReady = !hasHiddenRouteSkeleton();
      const docReady = document.readyState === "complete";
      const minTimeOk = elapsed >= MIN_VISIBLE_AFTER_ROUTE_MS;
      const timedOut = elapsed >= SKELETON_MAX_WAIT_MS;
      const currentPath = pathnameRef.current;
      const currentPendingPath = pendingPathRef.current;
      const homeDest =
        isCustomerHomePath(currentPendingPath ?? "") ||
        isCustomerHomePath(currentPath);
      const homeReady =
        !homeDest ||
        document.querySelector("main [data-customer-home-hub]") != null;

      if (timedOut) {
        clearSettle();
        navStartedRef.current = false;
        finishLoading();
        return;
      }

      if (skeletonGone && routeContentReady && docReady && minTimeOk && homeReady) {
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
  }, [clearSettle, finishLoading, isNavActive]);

  /** Hard refresh / first paint — soft-nav only listened to clicks before. */
  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let rafId = 0;

    const startInitialIfNeeded = () => {
      if (cancelled || navStartedRef.current) return true;
      // Home hub paints in-place — pending cover causes card double-mount flicker.
      if (pathname === "/" || pathname === "") return false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first paint only; pathname changes use click handler
  }, [beginNavigation, settleAfterRoute]);

  /** Keep pendingPath until pathname catches up — avoids sidebar chrome flicker. */
  useEffect(() => {
    if (pending) return;
    if (!pendingPath) return;
    if (pathname === pendingPath || pathname.startsWith(`${pendingPath}/`)) {
      reconcilePendingPath(pathname);
      return;
    }
    const t = window.setTimeout(
      () => reconcilePendingPath(pathname, { force: true }),
      600,
    );
    return () => window.clearTimeout(t);
  }, [pathname, pending, pendingPath, reconcilePendingPath]);

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
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (isQueryOnlyNavigation(pathname, url)) return;
      beginNavigation(url.pathname);
    };

    const onPopState = () => {
      if (window.location.pathname !== pathname) {
        beginNavigation(window.location.pathname);
      }
    };

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
