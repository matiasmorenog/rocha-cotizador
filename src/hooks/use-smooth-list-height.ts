"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/** Match `.quote-draft-row-*` / `.admin-late-row-*` timing (globals.css). */
export const SEARCH_TABLE_RESIZE_MS = 200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * FLIP height on a table/list shell when `resizeKey` changes (e.g. search
 * filtering growing/shrinking the row count, including empty ↔ results).
 * Same technique as `useSmoothDraftTableHeight` (quote-builder): measure
 * before/after height, lock the starting height, then transition to the new
 * one so the container eases instead of jumping. Ignores height changes that
 * don't come with a `resizeKey` change (e.g. an unrelated row expanding into
 * an edit form) so the animation stays scoped to search/filter resizes.
 */
export function useSmoothListHeight(
  lockRef: RefObject<HTMLElement | null>,
  resizeKey: string | number,
): void {
  const prevHeightRef = useRef<number | null>(null);
  const prevKeyRef = useRef<string | number | null>(null);

  useLayoutEffect(() => {
    const el = lockRef.current;
    if (!el) return;

    const next = el.scrollHeight;
    const prev = prevHeightRef.current;
    const keyChanged = prevKeyRef.current !== resizeKey;
    prevKeyRef.current = resizeKey;
    prevHeightRef.current = next;

    const shouldAnimate =
      keyChanged && prev != null && prev !== next && !prefersReducedMotion();

    if (!shouldAnimate) {
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
      return;
    }

    el.style.transition = "none";
    el.style.height = `${prev}px`;
    el.style.overflow = "hidden";
    void el.offsetHeight;
    el.style.transition = `height ${SEARCH_TABLE_RESIZE_MS}ms ease-out`;
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
    const fallback = window.setTimeout(clear, SEARCH_TABLE_RESIZE_MS + 40);

    return () => {
      window.clearTimeout(fallback);
      el.removeEventListener("transitionend", onEnd);
    };
  }, [lockRef, resizeKey]);
}
