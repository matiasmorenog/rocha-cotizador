"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { SEARCH_TABLE_RESIZE_MS } from "@/hooks/use-smooth-list-height";

const SEARCH_TABLE_RESIZE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function borderBoxWidth(entry: ResizeObserverEntry): number {
  const box = entry.borderBoxSize?.[0];
  return box ? box.inlineSize : entry.contentRect.width;
}

function headerCells(table: HTMLTableElement): HTMLTableCellElement[] {
  const row = table.tHead?.rows[0] ?? table.rows[0];
  return row ? Array.from(row.cells) : [];
}

function releaseLock(table: HTMLTableElement, cells: HTMLTableCellElement[]) {
  table.style.tableLayout = "";
  for (const cell of cells) {
    cell.style.width = "";
    cell.style.transition = "";
  }
}

/**
 * FLIP column widths on a `<table>` when `resizeKey` changes (search/filter
 * changing cell text length, row count, etc). `table-layout: fixed` sizes
 * every column from the first row's cell widths, so locking the header
 * `<th>` widths to their previous values then easing to the new ones eases
 * the whole table's columns — same technique (and same
 * `ResizeObserver`-backed "prev" fix) as `useSmoothListHeight`; see its doc
 * comment for why a render-phase or post-commit `getBoundingClientRect()`
 * read for "prev" silently broke the shrink direction. Releases the lock
 * (back to `table-layout: auto`) once the transition ends so normal
 * content-driven/responsive sizing resumes at rest.
 */
export function useSmoothColumnWidths(
  tableRef: RefObject<HTMLTableElement | null>,
  resizeKey: string | number,
): void {
  const prevKeyRef = useRef<string | number | null>(null);
  const mountedRef = useRef(false);
  const lastWidthsRef = useRef(new Map<HTMLTableCellElement, number>());
  const observerRef = useRef<ResizeObserver | null>(null);

  // Mount-only: one observer, kept alive for the component's life, tracking
  // each header cell's real rendered width continuously (see
  // `useSmoothListHeight` doc comment for why this must live in an effect
  // rather than be read during render).
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        lastWidthsRef.current.set(
          entry.target as HTMLTableCellElement,
          borderBoxWidth(entry),
        );
      }
    });
    observerRef.current = ro;
    return () => {
      ro.disconnect();
      observerRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const table = tableRef.current;
    const keyChanged = prevKeyRef.current !== resizeKey;
    prevKeyRef.current = resizeKey;
    if (!table || !keyChanged) return;

    const cells = headerCells(table);
    if (cells.length === 0) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      for (const cell of cells) {
        lastWidthsRef.current.set(cell, cell.getBoundingClientRect().width);
        observerRef.current?.observe(cell);
      }
      return;
    }

    // "prev": widths recorded before this commit — the observer's own
    // notification for *this* commit's resize hasn't been delivered yet
    // (see `useSmoothListHeight`), so the map still holds the pre-update
    // values. A cell the observer never saw (e.g. a brand new column from
    // an `editMode` toggle) falls back to its current rect.
    const prevWidths = cells.map(
      (cell) =>
        lastWidthsRef.current.get(cell) ?? cell.getBoundingClientRect().width,
    );

    releaseLock(table, cells);
    const nextWidths = cells.map((cell) => cell.getBoundingClientRect().width);

    for (const cell of cells) {
      observerRef.current?.observe(cell);
    }

    const unchanged = prevWidths.every(
      (w, i) => Math.abs(w - nextWidths[i]) < 0.5,
    );
    if (unchanged || prefersReducedMotion()) return;

    cells.forEach((cell, i) => {
      cell.style.transition = "none";
      cell.style.width = `${prevWidths[i]}px`;
    });
    table.style.tableLayout = "fixed";
    void table.offsetHeight;
    cells.forEach((cell, i) => {
      cell.style.transition = `width ${SEARCH_TABLE_RESIZE_MS}ms ${SEARCH_TABLE_RESIZE_EASE}`;
      cell.style.width = `${nextWidths[i]}px`;
    });

    const clear = () => {
      if (tableRef.current !== table) return;
      releaseLock(table, cells);
    };

    const lastCell = cells[cells.length - 1];
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== lastCell || e.propertyName !== "width") return;
      clear();
      lastCell.removeEventListener("transitionend", onEnd);
    };
    lastCell.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(clear, SEARCH_TABLE_RESIZE_MS + 40);

    return () => {
      window.clearTimeout(fallback);
      lastCell.removeEventListener("transitionend", onEnd);
    };
  }, [tableRef, resizeKey]);
}
