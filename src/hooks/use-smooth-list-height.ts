"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Deliberately slower than `.quote-draft-row-*` / `.admin-late-row-*` (200ms,
 * globals.css): those are small per-row enter/exit effects, while this eases
 * the whole table shell's height/columns — at 200ms a small row-count delta
 * read as an instant jump. 320ms keeps it clearly visible without feeling
 * sluggish. Shared by `useSmoothColumnWidths`.
 */
export const SEARCH_TABLE_RESIZE_MS = 320;

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
 *
 * `prev`/`next` are measured fresh each run instead of cached in a ref:
 * `scrollHeight` is `max(clientHeight, contentHeight)`, so a cached value
 * taken while a previous transition was still mid-flight (e.g. fast typing
 * that fires this effect again before the last 200ms resize finished) can
 * report a stale, too-large height. That's harmless for *growth* (content is
 * already ≥ the animating height), but it silently broke *shrink* — the
 * shell would barely move each keystroke, then snap to the true (smaller)
 * height instantly once `clear()` released the lock. Reading live geometry
 * (`getBoundingClientRect` for "prev", and a momentarily unlocked
 * `scrollHeight` for "next") keeps both directions accurate even when resizes
 * interrupt each other.
 */
export function useSmoothListHeight(
  lockRef: RefObject<HTMLElement | null>,
  resizeKey: string | number,
): void {
  const prevKeyRef = useRef<string | number | null>(null);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    const el = lockRef.current;
    const keyChanged = prevKeyRef.current !== resizeKey;
    prevKeyRef.current = resizeKey;
    if (!el || !keyChanged) return;

    if (!mountedRef.current) {
      // Skip the initial mount — nothing to animate from yet.
      mountedRef.current = true;
      return;
    }

    // Current on-screen height — accurate even mid-transition, unlike a
    // cached ref (see doc comment above).
    const prev = el.getBoundingClientRect().height;

    // Momentarily release any lock so `scrollHeight` reflects the *natural*
    // height of the current DOM rather than a stale locked value.
    el.style.transition = "none";
    el.style.height = "";
    const next = el.scrollHeight;

    if (prev === next || prefersReducedMotion()) {
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
      return;
    }

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
