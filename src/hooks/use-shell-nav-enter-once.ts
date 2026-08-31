"use client";

import { useLayoutEffect, useState } from "react";

/** Survives CustomerNav remount (pending overlay → layout shell). */
let shellNavEnterPlayed = false;

export type ShellNavEnterState = {
  /** Sidebar content can render (skip opacity gate). */
  ready: boolean;
  /** Play enter motion on this mount; latched so layout does not flip after. */
  animate: boolean;
};

/**
 * Sidebar enter motion once per session when desktop nav first appears.
 * `enabled=false` (e.g. home hub without sidebar) does not consume the flag.
 */
export function useShellNavEnterOnce(enabled = true): ShellNavEnterState {
  const [latched, setLatched] = useState(false);
  const [ready, setReady] = useState(() => !enabled);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- layout sync for sidebar reveal gate */
    if (!enabled) {
      setReady(true);
      return;
    }
    if (!shellNavEnterPlayed) {
      shellNavEnterPlayed = true;
      setLatched(true);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [enabled]);

  const animate = latched || (enabled && !shellNavEnterPlayed);

  return { ready, animate };
}
