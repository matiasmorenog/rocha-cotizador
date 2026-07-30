"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";

/** First paint window for admin tables / long lists. */
export const INCREMENTAL_REVEAL_INITIAL = 50;
/** Extra rows when user scrolls near the end. */
export const INCREMENTAL_REVEAL_STEP = 50;
/** Dropdown pickers: first paint (search still over full in-memory set). */
export const PICKER_REVEAL_INITIAL = 30;
export const PICKER_REVEAL_STEP = 30;

type UseIncrementalRevealOptions = {
  initial?: number;
  step?: number;
  /**
   * Reset the visible window when this value changes (e.g. search query).
   * Defaults to `items` reference.
   */
  resetKey?: unknown;
};

type LimitState = {
  resetKey: unknown;
  initial: number;
  limit: number;
};

/**
 * Render-only windowing: keep filtering over the full in-memory array,
 * but only expose the first `limit` rows to the DOM. Grow on scroll /
 * IntersectionObserver / keyboard ensureIndex — no extra network.
 */
export function useIncrementalReveal<T>(
  items: readonly T[],
  options?: UseIncrementalRevealOptions,
) {
  const initial = options?.initial ?? INCREMENTAL_REVEAL_INITIAL;
  const step = options?.step ?? INCREMENTAL_REVEAL_STEP;
  const resetKey = options?.resetKey ?? items;

  const [state, setState] = useState<LimitState>({
    resetKey,
    initial,
    limit: initial,
  });

  // Adjust state during render when the filter/query window should reset
  // (React-recommended alternative to setState-in-effect).
  if (state.resetKey !== resetKey || state.initial !== initial) {
    setState({ resetKey, initial, limit: initial });
  }

  const limit =
    state.resetKey !== resetKey || state.initial !== initial
      ? initial
      : state.limit;

  const visible = useMemo(
    () => items.slice(0, Math.min(limit, items.length)),
    [items, limit],
  );
  const hasMore = limit < items.length;

  const revealMore = useCallback(() => {
    setState((prev) => {
      if (prev.resetKey !== resetKey || prev.initial !== initial) {
        return { resetKey, initial, limit: Math.min(initial + step, items.length) };
      }
      if (prev.limit >= items.length) return prev;
      return {
        ...prev,
        limit: Math.min(prev.limit + step, items.length),
      };
    });
  }, [resetKey, initial, step, items.length]);

  /** Grow window so `index` (0-based in full list) is painted. */
  const ensureIndex = useCallback(
    (index: number) => {
      if (index < 0) return;
      const need = index + 1;
      setState((prev) => {
        if (prev.resetKey !== resetKey || prev.initial !== initial) {
          return {
            resetKey,
            initial,
            limit: Math.min(Math.max(need, initial), items.length),
          };
        }
        if (need <= prev.limit) return prev;
        return {
          ...prev,
          limit: Math.min(need, items.length),
        };
      });
    },
    [resetKey, initial, items.length],
  );

  const onScroll = useCallback(
    (e: UIEvent<HTMLElement>) => {
      if (!hasMore) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 64) return;
      revealMore();
    },
    [hasMore, revealMore],
  );

  return {
    visible,
    hasMore,
    limit,
    total: items.length,
    revealMore,
    ensureIndex,
    onScroll,
  };
}

/**
 * Sentinel for page-level (or container) scroll: when it enters view, reveal more.
 * Re-observes when `observeKey` changes so a still-visible sentinel keeps filling.
 */
export function useRevealOnIntersect<T extends Element = HTMLElement>(
  enabled: boolean,
  onReveal: () => void,
  observeKey?: unknown,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onReveal();
        }
      },
      { root: null, rootMargin: "160px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, onReveal, observeKey]);

  return ref;
}

/** Table footer sentinel — paints more rows as the user scrolls the page. */
export function RevealMoreTableRow({
  colSpan,
  enabled,
  onReveal,
  shown,
  total,
}: {
  colSpan: number;
  enabled: boolean;
  onReveal: () => void;
  shown: number;
  total: number;
}) {
  const ref = useRevealOnIntersect<HTMLTableRowElement>(
    enabled,
    onReveal,
    shown,
  );
  if (!enabled) return null;
  return (
    <tr ref={ref} className="border-t border-neutral-100" aria-hidden>
      <td
        colSpan={colSpan}
        className="px-3 py-2 text-center text-xs text-neutral-400"
      >
        Mostrando {shown} de {total} — desplazá para ver más…
      </td>
    </tr>
  );
}
