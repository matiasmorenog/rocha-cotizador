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
  /** 0–100 fill; idle stays at 100. */
  progress: number;
  startLoading: () => void;
  finishLoading: () => void;
};

const RouteLoadingContext = createContext<RouteLoadingContextValue | null>(null);

const START_PCT = 8;
const TRICKLE_CAP = 92;
const TRICKLE_MS = 350;

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(100);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  const clearTrickle = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
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

  const startLoading = useCallback(() => {
    activeRef.current = true;
    setProgress(START_PCT);
    startTrickle();
  }, [startTrickle]);

  const finishLoading = useCallback(() => {
    clearTrickle();
    if (!activeRef.current) {
      setProgress(100);
      return;
    }
    activeRef.current = false;
    setProgress(100);
  }, [clearTrickle]);

  useEffect(() => {
    return () => clearTrickle();
  }, [clearTrickle]);

  const value = useMemo(
    () => ({
      progress,
      startLoading,
      finishLoading,
    }),
    [progress, startLoading, finishLoading],
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
