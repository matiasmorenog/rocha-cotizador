"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import {
  QUOTE_DRAFT_ROW_MOTION_MS,
  type EmptyPhase,
} from "@/components/quote/use-animated-draft-lines";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * FLIP height on the draft table shell when row structure changes.
 * - Grows when adding rows (parallel with fade/slide enter).
 * - Eases empty ↔ first product (shrink or grow) without a height valley.
 * - Skips shrink after CSS cell-close exit (avoids re-expand flash).
 */
export function useSmoothDraftTableHeight(
  lockRef: RefObject<HTMLElement | null>,
  structureKey: string,
  emptyPhase: EmptyPhase,
): void {
  const prevHeightRef = useRef<number | null>(null);
  const prevKeyRef = useRef<string | null>(null);
  const prevEmptyRef = useRef<EmptyPhase>(emptyPhase);

  useLayoutEffect(() => {
    const el = lockRef.current;
    if (!el) return;

    const next = el.scrollHeight;
    const prev = prevHeightRef.current;
    const keyChanged = prevKeyRef.current !== structureKey;
    const emptyJustHidden =
      prevEmptyRef.current !== "hidden" && emptyPhase === "hidden";
    const emptyJustShown =
      prevEmptyRef.current === "hidden" && emptyPhase === "shown";

    prevKeyRef.current = structureKey;
    prevEmptyRef.current = emptyPhase;

    if (!keyChanged) {
      prevHeightRef.current = next;
      return;
    }

    const shouldAnimate =
      prev != null &&
      !prefersReducedMotion() &&
      prev !== next &&
      (next > prev || emptyJustHidden || emptyJustShown);

    if (!shouldAnimate) {
      prevHeightRef.current = next;
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
      return;
    }

    prevHeightRef.current = next;
    el.style.transition = "none";
    el.style.height = `${prev}px`;
    el.style.overflow = "hidden";
    void el.offsetHeight;
    el.style.transition = `height ${QUOTE_DRAFT_ROW_MOTION_MS}ms ease-out`;
    el.style.height = `${next}px`;

    const clear = () => {
      if (lockRef.current !== el) return;
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
    };

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "height") return;
      clear();
      el.removeEventListener("transitionend", onEnd);
    };
    el.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(clear, QUOTE_DRAFT_ROW_MOTION_MS + 40);

    return () => {
      window.clearTimeout(fallback);
      el.removeEventListener("transitionend", onEnd);
    };
  }, [lockRef, structureKey, emptyPhase]);
}
