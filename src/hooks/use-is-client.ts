"use client";

import { useSyncExternalStore } from "react";

/** Client-only gate for portals (avoids SSR/hydration mismatch). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
