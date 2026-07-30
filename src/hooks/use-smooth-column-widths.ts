"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { SEARCH_TABLE_RESIZE_MS } from "@/hooks/use-smooth-list-height";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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
 * the whole table's columns — same FLIP technique as `useSmoothListHeight`,
 * applied per-column instead of to the shell height. Releases the lock (back
 * to `table-layout: auto`) once the transition ends so normal
 * content-driven/responsive sizing resumes at rest.
 */
export function useSmoothColumnWidths(
  tableRef: RefObject<HTMLTableElement | null>,
  resizeKey: string | number,
): void {
  const prevKeyRef = useRef<string | number | null>(null);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    const table = tableRef.current;
    const keyChanged = prevKeyRef.current !== resizeKey;
    prevKeyRef.current = resizeKey;
    if (!table || !keyChanged) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const cells = headerCells(table);
    if (cells.length === 0) return;

    // Live geometry — accurate even mid-transition (same reasoning as
    // useSmoothListHeight: scrollWidth's max(clientWidth, contentWidth)
    // would report a stale width for an interrupted resize).
    const prevWidths = cells.map((cell) => cell.getBoundingClientRect().width);

    releaseLock(table, cells);
    const nextWidths = cells.map((cell) => cell.getBoundingClientRect().width);

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
      cell.style.transition = `width ${SEARCH_TABLE_RESIZE_MS}ms ease-out`;
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
