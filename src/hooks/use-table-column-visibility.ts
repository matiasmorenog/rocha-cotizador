"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { SEARCH_TABLE_RESIZE_MS } from "@/hooks/use-smooth-list-height";

export type TableColumnDef = {
  id: string;
  label: string;
  /** Always shown; omitted from the Columnas checklist. */
  locked?: boolean;
};

function storageKeyFor(tableId: string, userId?: string | null): string {
  const base = `rocha-table-cols:${tableId}`;
  return userId ? `${base}:${userId}` : base;
}

function sameTabEventName(storageKey: string): string {
  return `rocha-table-cols-change:${storageKey}`;
}

function readRaw(storageKey: string): string {
  if (typeof window === "undefined") return "[]";
  try {
    return localStorage.getItem(storageKey) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseHiddenIds(raw: string): Set<string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((x): x is string => typeof x === "string" && x.length > 0),
    );
  } catch {
    return new Set();
  }
}

function writeHiddenIds(storageKey: string, hidden: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...hidden]));
    window.dispatchEvent(new Event(sameTabEventName(storageKey)));
  } catch {
    // ignore quota
  }
}

function subscribeStorage(storageKey: string, onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) onChange();
  };
  const onSameTab = () => onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(sameTabEventName(storageKey), onSameTab);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(sameTabEventName(storageKey), onSameTab);
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Per-browser column visibility for admin tables (localStorage).
 * Locked columns (Código / Nombre / acciones) always stay visible.
 * Hide keeps the column mounted briefly with `data-col-collapse` so
 * `useSmoothColumnWidths` can FLIP width to 0 (same as remito edit chrome).
 */
export function useTableColumnVisibility(
  tableId: string,
  columns: readonly TableColumnDef[],
  userId?: string | null,
) {
  const storageKey = storageKeyFor(tableId, userId);
  const lockedIds = useMemo(
    () => new Set(columns.filter((c) => c.locked).map((c) => c.id)),
    [columns],
  );
  const knownIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);
  const toggleableColumns = useMemo(
    () => columns.filter((c) => !c.locked),
    [columns],
  );

  const raw = useSyncExternalStore(
    (onChange) => subscribeStorage(storageKey, onChange),
    () => readRaw(storageKey),
    () => "[]",
  );

  const hidden = useMemo(() => {
    const loaded = parseHiddenIds(raw);
    const cleaned = new Set<string>();
    for (const id of loaded) {
      if (knownIds.has(id) && !lockedIds.has(id)) cleaned.add(id);
    }
    return cleaned;
  }, [raw, knownIds, lockedIds]);

  const [exiting, setExiting] = useState<Set<string>>(() => new Set());
  const exitTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
    };
  }, []);

  const clearExitTimer = useCallback((id: string) => {
    const t = exitTimersRef.current.get(id);
    if (t != null) {
      window.clearTimeout(t);
      exitTimersRef.current.delete(id);
    }
  }, []);

  const beginExit = useCallback(
    (id: string) => {
      clearExitTimer(id);
      setExiting((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      exitTimersRef.current.set(
        id,
        window.setTimeout(() => {
          exitTimersRef.current.delete(id);
          setExiting((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, SEARCH_TABLE_RESIZE_MS),
      );
    },
    [clearExitTimer],
  );

  /** Desired visibility (checklist checked). Locked always true. */
  const isVisible = useCallback(
    (id: string) => {
      if (lockedIds.has(id)) return true;
      return !hidden.has(id);
    },
    [hidden, lockedIds],
  );

  /** Still in the DOM (visible or collapsing out). */
  const isPresent = useCallback(
    (id: string) => {
      if (lockedIds.has(id)) return true;
      return !hidden.has(id) || exiting.has(id);
    },
    [exiting, hidden, lockedIds],
  );

  /** Mark header/cells for width→0 FLIP via `data-col-collapse`. */
  const isCollapsing = useCallback(
    (id: string) => exiting.has(id),
    [exiting],
  );

  const setColumnVisible = useCallback(
    (id: string, visible: boolean) => {
      if (lockedIds.has(id) || !knownIds.has(id)) return;
      const next = new Set(parseHiddenIds(readRaw(storageKey)));
      if (visible) {
        clearExitTimer(id);
        setExiting((prev) => {
          if (!prev.has(id)) return prev;
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
        next.delete(id);
      } else {
        next.add(id);
        if (!prefersReducedMotion()) beginExit(id);
        else {
          clearExitTimer(id);
          setExiting((prev) => {
            if (!prev.has(id)) return prev;
            const copy = new Set(prev);
            copy.delete(id);
            return copy;
          });
        }
      }
      for (const hid of [...next]) {
        if (!knownIds.has(hid) || lockedIds.has(hid)) next.delete(hid);
      }
      writeHiddenIds(storageKey, next);
    },
    [beginExit, clearExitTimer, knownIds, lockedIds, storageKey],
  );

  const showAllColumns = useCallback(() => {
    for (const id of exitTimersRef.current.keys()) clearExitTimer(id);
    setExiting(new Set());
    writeHiddenIds(storageKey, new Set());
  }, [clearExitTimer, storageKey]);

  const presentDataColumnCount = useMemo(() => {
    let n = 0;
    for (const col of columns) {
      if (col.id === "actions") continue;
      if (isPresent(col.id)) n += 1;
    }
    return n;
  }, [columns, isPresent]);

  /** Include in table resize keys when hide/show or collapse phase changes. */
  const visibilityKey = useMemo(() => {
    const h = [...hidden].sort().join(",");
    const e = [...exiting].sort().join(",");
    return `${h}|e:${e}`;
  }, [exiting, hidden]);

  return {
    toggleableColumns,
    isVisible,
    isPresent,
    isCollapsing,
    setColumnVisible,
    showAllColumns,
    /** +1 for the trailing actions column when present. */
    colSpan: presentDataColumnCount + (knownIds.has("actions") ? 1 : 0),
    visibilityKey,
    hiddenCount: hidden.size,
  };
}
