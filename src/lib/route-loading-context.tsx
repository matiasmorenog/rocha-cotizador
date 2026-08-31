"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RouteLoadingContextValue = {
  /** 0–100 fill while navigating; 0 when hidden. */
  progress: number;
  /** Progress bar visible (includes brief done flash). */
  visible: boolean;
  /** True from nav start until settle — cover main with skeleton. */
  pending: boolean;
  /** Destination pathname for pending skeleton (click href). */
  pendingPath: string | null;
  startLoading: (path?: string | null) => void;
  finishLoading: () => void;
  /** Drop pendingPath once the router pathname has caught up (or force after timeout). */
  reconcilePendingPath: (pathname: string, opts?: { force?: boolean }) => void;
  /** Sync read of startLoading — overlay settle must not wait for React state. */
  isNavActive: () => boolean;
};

const RouteLoadingContext = createContext<RouteLoadingContextValue | null>(null);

const START_PCT = 8;
const TRICKLE_CAP = 92;
const TRICKLE_MS = 350;
const HIDE_AFTER_DONE_MS = 280;

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearTrickle = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
  }, []);

  const clearHide = useCallback(() => {
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  }, []);

  const startTrickle = useCallback(() => {
    clearTrickle();
    trickleRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= TRICKLE_CAP) return prev;
        // Asymptotic trickle toward cap (NProgress-style).
        const remaining = TRICKLE_CAP - prev;
        const step = Math.max(0.4, remaining * 0.08);
        return Math.min(TRICKLE_CAP, prev + step);
      });
    }, TRICKLE_MS);
  }, [clearTrickle]);

  const startLoading = useCallback(
    (path?: string | null) => {
      clearHide();
      activeRef.current = true;
      setPending(true);
      setPendingPath(path ?? null);
      setProgress(START_PCT);
      setVisible(true);
      startTrickle();
    },
    [clearHide, startTrickle],
  );

  const finishLoading = useCallback(() => {
    clearTrickle();
    setPending(false);
    if (!activeRef.current) {
      setVisible(false);
      setProgress(0);
      return;
    }
    activeRef.current = false;
    setProgress(100);
    clearHide();
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      hideRef.current = null;
    }, HIDE_AFTER_DONE_MS);
  }, [clearHide, clearTrickle]);

  const reconcilePendingPath = useCallback(
    (pathname: string, opts?: { force?: boolean }) => {
      setPendingPath((prev) => {
        if (!prev) return null;
        if (opts?.force) return null;
        if (pathname === prev || pathname.startsWith(`${prev}/`)) return null;
        return prev;
      });
    },
    [],
  );

  const isNavActive = useCallback(() => activeRef.current, []);

  useEffect(() => {
    return () => {
      clearTrickle();
      clearHide();
    };
  }, [clearTrickle, clearHide]);

  const value = useMemo(
    () => ({
      progress,
      visible,
      pending,
      pendingPath,
      startLoading,
      finishLoading,
      reconcilePendingPath,
      isNavActive,
    }),
    [
      progress,
      visible,
      pending,
      pendingPath,
      startLoading,
      finishLoading,
      reconcilePendingPath,
      isNavActive,
    ],
  );

  return (
    <RouteLoadingContext.Provider value={value}>
      {children}
    </RouteLoadingContext.Provider>
  );
}

export function useRouteLoading() {
  const context = useContext(RouteLoadingContext);
  if (!context) {
    throw new Error("useRouteLoading debe usarse dentro de RouteLoadingProvider");
  }
  return context;
}
