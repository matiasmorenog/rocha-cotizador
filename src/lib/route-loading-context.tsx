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
  visible: boolean;
  overlayVisible: boolean;
  startLoading: () => void;
  finishLoading: () => void;
};

const RouteLoadingContext = createContext<RouteLoadingContextValue | null>(null);

const START_PCT = 8;
const TRICKLE_CAP = 92;
const TRICKLE_MS = 350;
const HIDE_AFTER_DONE_MS = 280;

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
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

  const startLoading = useCallback(() => {
    clearHide();
    activeRef.current = true;
    setProgress(START_PCT);
    setVisible(true);
    setOverlayVisible(true);
    startTrickle();
  }, [clearHide, startTrickle]);

  const finishLoading = useCallback(() => {
    clearTrickle();
    setOverlayVisible(false);
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
      overlayVisible,
      startLoading,
      finishLoading,
    }),
    [progress, visible, overlayVisible, startLoading, finishLoading],
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
