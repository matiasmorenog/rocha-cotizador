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
    cell.style.minWidth = "";
    cell.style.overflow = "";
    cell.style.paddingLeft = "";
    cell.style.paddingRight = "";
    cell.style.display = "";
  }
}

/**
 * Hide every cell in columns marked `data-col-collapse` so auto-layout
 * measures the true post-exit widths (content-sized). Measuring under
 * `table-layout: fixed` with only the header at 0px equalizes the remaining
 * columns — then releaseLock snaps them to content. `display: none` matches
 * unmount for intrinsic sizing.
 */
function softHideCollapseColumns(
  table: HTMLTableElement,
  header: HTMLTableCellElement[],
): () => void {
  const collapseIdx = header
    .map((cell, i) => (cell.hasAttribute("data-col-collapse") ? i : -1))
    .filter((i) => i >= 0);
  if (collapseIdx.length === 0) return () => undefined;

  const hidden: HTMLTableCellElement[] = [];
  for (const row of Array.from(table.rows)) {
    for (const i of collapseIdx) {
      const cell = row.cells[i];
      if (!cell) continue;
      cell.style.display = "none";
      hidden.push(cell);
    }
  }
  void table.offsetHeight;

  return () => {
    for (const cell of hidden) cell.style.display = "";
  };
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
 *
 * Header cells with `data-col-collapse` are soft-hidden (`display: none` on
 * the whole column) before measuring "next" under auto layout, so exit FLIP
 * targets content widths — not equalized fixed tracks.
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
    // values. A brand-new header cell (remito edit enter) has no map entry
    // → treat as 0 so the actions column FLIP-grows instead of appearing
    // already at full width.
    const prevWidths = cells.map(
      (cell) => lastWidthsRef.current.get(cell) ?? 0,
    );

    releaseLock(table, cells);

    const restoreCollapse = softHideCollapseColumns(table, cells);
    const nextWidths = cells.map((cell) => {
      if (cell.hasAttribute("data-col-collapse")) return 0;
      return cell.getBoundingClientRect().width;
    });
    restoreCollapse();

    const collapsing = cells.filter((c) => c.hasAttribute("data-col-collapse"));

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
      // Clip while growing from 0 or collapsing to 0 so button chrome doesn't
      // paint outside the shrinking/growing track.
      if (
        cell.hasAttribute("data-col-collapse") ||
        prevWidths[i] < 0.5 ||
        nextWidths[i] < 0.5
      ) {
        cell.style.overflow = "hidden";
        cell.style.minWidth = "0px";
      }
      if (cell.hasAttribute("data-col-collapse") || nextWidths[i] < 0.5) {
        cell.style.paddingLeft = "0px";
        cell.style.paddingRight = "0px";
      }
    });
    table.style.tableLayout = "fixed";
    void table.offsetHeight;
    cells.forEach((cell, i) => {
      cell.style.transition = `width ${SEARCH_TABLE_RESIZE_MS}ms ${SEARCH_TABLE_RESIZE_EASE}`;
      cell.style.width = `${nextWidths[i]}px`;
    });

    const clear = () => {
      if (tableRef.current !== table) return;
      if (collapsing.length > 0) {
        // Keep final pixel lock until the column unmounts — releasing to auto
        // while faded action buttons still exist would re-expand that column
        // and snap the rest. A later resizeKey bump (chrome unmount) clears.
        table.style.tableLayout = "fixed";
        cells.forEach((cell, i) => {
          cell.style.transition = "";
          cell.style.width = `${nextWidths[i]}px`;
          if (cell.hasAttribute("data-col-collapse") || nextWidths[i] < 0.5) {
            cell.style.overflow = "hidden";
            cell.style.minWidth = "0px";
            cell.style.paddingLeft = "0px";
            cell.style.paddingRight = "0px";
          }
        });
        return;
      }
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
