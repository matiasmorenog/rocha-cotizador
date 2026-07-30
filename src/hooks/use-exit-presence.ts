"use client";

import { useEffect, useRef, useState } from "react";

/** Keep in sync with `.quote-picker-float-*` duration in globals.css */
export const QUOTE_PICKER_FLOAT_MS = 200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Phase = "closed" | "open" | "exiting";

/**
 * Keep mount for `exitMs` after open→false so exit CSS can run.
 * `prefers-reduced-motion: reduce` → unmount instantly.
 * `animKey` bumps on each open (and reopen during exit) to restart enter.
 */
export function useExitPresence(open: boolean, exitMs = QUOTE_PICKER_FLOAT_MS) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const [animKey, setAnimKey] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);
  const genRef = useRef(0);

  // Adjust phase when `open` flips (React: update state during render from props).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPhase("open");
      setAnimKey((k) => k + 1);
    } else if (prefersReducedMotion()) {
      setPhase("closed");
    } else {
      setPhase("exiting");
    }
  }

  useEffect(() => {
    if (phase === "open") {
      genRef.current += 1;
      return;
    }
    if (phase !== "exiting") return;

    const gen = ++genRef.current;
    const t = window.setTimeout(() => {
      if (gen !== genRef.current) return;
      setPhase("closed");
    }, exitMs);
    return () => window.clearTimeout(t);
  }, [phase, exitMs]);

  return {
    present: phase !== "closed",
    exiting: phase === "exiting",
    animKey,
  } as const;
}
