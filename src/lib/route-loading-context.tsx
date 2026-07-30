"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RouteLoadingBarState = "loading" | "complete";

type RouteLoadingContextValue = {
  barState: RouteLoadingBarState;
  overlayVisible: boolean;
  startLoading: () => void;
  finishLoading: () => void;
};

const RouteLoadingContext = createContext<RouteLoadingContextValue | null>(null);

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const [barState, setBarState] = useState<RouteLoadingBarState>("complete");
  const [overlayVisible, setOverlayVisible] = useState(false);

  const startLoading = useCallback(() => {
    setBarState("loading");
    setOverlayVisible(true);
  }, []);

  const finishLoading = useCallback(() => {
    setBarState("complete");
    setOverlayVisible(false);
  }, []);

  const value = useMemo(
    () => ({
      barState,
      overlayVisible,
      startLoading,
      finishLoading,
    }),
    [barState, overlayVisible, startLoading, finishLoading],
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
