"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Deliberately slower than `.quote-draft-row-*` / `.admin-late-row-*` (200ms,
 * globals.css): those are small per-row enter/exit effects, while this eases
 * the whole table shell's height/columns. Bumped 320 → 480ms + a steeper
 * ease-out after user testing showed shrink (fewer rows while typing a
 * filter) still read as broken/instant while grow (clearing the filter)
 * looked smooth — see the root-cause note below. Shared by
 * `useSmoothColumnWidths`.
 */
export const SEARCH_TABLE_RESIZE_MS = 480;
const SEARCH_TABLE_RESIZE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function borderBoxHeight(entry: ResizeObserverEntry): number {
  const box = entry.borderBoxSize?.[0];
  return box ? box.blockSize : entry.contentRect.height;
}

/**
 * FLIP height on a table/list shell when `resizeKey` changes (e.g. search
 * filtering growing/shrinking the row count, including empty ↔ results).
 *
 * ROOT CAUSE (grow worked, shrink didn't): the previous implementation read
 * "prev" with `getBoundingClientRect()` *inside* `useLayoutEffect`. Layout
 * effects always run *after* React has already mutated the DOM for the
 * current commit, so by the time that read happens the box (which has no
 * explicit height between animations — it's `auto`) has *already* resized
 * to fit the *new* row count. Reading "prev" then doesn't reliably capture
 * "what the user was just looking at" — it can silently collapse to the
 * *same* value as "next", especially once a previous transition has settled
 * and released its `height` lock, which happens to line up more often with
 * shrink in real typing (each shrink step usually starts from an already-
 * settled state, since removed rows unmount immediately with no exit
 * animation of their own to keep the box "busy"; grow's target is simply
 * ≥ the current locked height more often, which masked the same bug there).
 *
 * A render-phase read (measuring before the DOM mutates) would fix this, but
 * React's `react-hooks/refs` lint rule (rightly) forbids reading refs during
 * render — a render can be thrown away without committing. Instead, a
 * `ResizeObserver` tracks the shell's *actual* rendered size continuously
 * from a proper effect (never during render): its notifications are
 * delivered slightly *after* the synchronous commit + layout effects for
 * whatever DOM mutation caused the resize, so `lastHeightRef` — updated only
 * from the observer's callback — is guaranteed to still hold the size from
 * *before* the current commit when this effect's "did `resizeKey` change?"
 * check runs. That gives an accurate "prev" for both directions, and it
 * keeps being accurate even when a keystroke interrupts a still-running
 * transition, since the observer also fires (with the live, interpolated
 * value) while a CSS transition is mid-flight.
 */
export function useSmoothListHeight(
  lockRef: RefObject<HTMLElement | null>,
  resizeKey: string | number,
): void {
  const prevKeyRef = useRef<string | number | null>(null);
  const mountedRef = useRef(false);
  const lastHeightRef = useRef<number | null>(null);

  // Mount-only: track the shell's real rendered height continuously, from a
  // proper effect callback (not render) — see doc comment above.
  useLayoutEffect(() => {
    const el = lockRef.current;
    if (!el) return;

    lastHeightRef.current = el.getBoundingClientRect().height;

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) lastHeightRef.current = borderBoxHeight(entry);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [lockRef]);

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

    const prev = lastHeightRef.current ?? el.getBoundingClientRect().height;

    // Momentarily release any lock so `scrollHeight` reflects the *natural*
    // height of the current (already-committed) DOM.
    el.style.transition = "none";
    el.style.height = "";
    const next = el.scrollHeight;

    if (Math.abs(prev - next) < 0.5 || prefersReducedMotion()) {
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
      return;
    }

    el.style.height = `${prev}px`;
    el.style.overflow = "hidden";
    void el.offsetHeight;
    el.style.transition = `height ${SEARCH_TABLE_RESIZE_MS}ms ${SEARCH_TABLE_RESIZE_EASE}`;
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
