"use client";

import { useCallback, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export type SortState<K extends string> = {
  key: K;
  dir: SortDir;
} | null;

export type SortValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

/** Click cycle: none → asc → desc → none. */
export function useTableSort<K extends string>(initial: SortState<K> = null) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggle = useCallback((key: K) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }, []);

  return { sort, toggle, setSort };
}

function compareSortValues(a: SortValue, b: SortValue): number {
  const aNull = a == null || a === "";
  const bNull = b == null || b === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  return String(a).localeCompare(String(b), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Stable copy sorted by `sort`. When `sort` is null, returns `rows` unchanged
 * (same reference) so callers can skip re-renders.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  getters: Record<K, (row: T) => SortValue>,
): T[] {
  if (!sort) return rows;
  const get = getters[sort.key];
  const mult = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort(
    (left, right) => mult * compareSortValues(get(left), get(right)),
  );
}

/** Memoized sorted list; keeps original order when sort is cleared. */
export function useSortedRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  getters: Record<K, (row: T) => SortValue>,
): T[] {
  return useMemo(
    () => sortRows(rows, sort, getters),
    [rows, sort, getters],
  );
}
