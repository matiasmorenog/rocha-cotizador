"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  DASHBOARD_KPI_CATALOG,
  DASHBOARD_KPI_IDS,
  DEFAULT_DASHBOARD_KPI_IDS,
  MAX_DASHBOARD_KPIS,
  normalizeDashboardKpiSelection,
  type DashboardKpiId,
} from "@/lib/admin-dashboard-kpi-catalog";

function storageKeyFor(userId?: string | null): string {
  const base = "rocha-dashboard-kpis";
  return userId ? `${base}:${userId}` : base;
}

function sameTabEventName(storageKey: string): string {
  return `rocha-dashboard-kpis-change:${storageKey}`;
}

function readRaw(storageKey: string): string {
  if (typeof window === "undefined") return "null";
  try {
    return localStorage.getItem(storageKey) ?? "null";
  } catch {
    return "null";
  }
}

function writeSelected(storageKey: string, ids: DashboardKpiId[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
    window.dispatchEvent(new Event(sameTabEventName(storageKey)));
  } catch {
    // ignore quota
  }
}

function parseSelected(raw: string): DashboardKpiId[] {
  if (raw === "null" || raw === "") {
    return [...DEFAULT_DASHBOARD_KPI_IDS];
  }
  try {
    return normalizeDashboardKpiSelection(JSON.parse(raw) as unknown);
  } catch {
    return [...DEFAULT_DASHBOARD_KPI_IDS];
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

/**
 * Persist up to {@link MAX_DASHBOARD_KPIS} dashboard KPI ids (localStorage),
 * same storage/sync pattern as `useTableColumnVisibility`.
 */
export function useDashboardKpiSelection(userId?: string | null) {
  const storageKey = storageKeyFor(userId);

  const raw = useSyncExternalStore(
    (onChange) => subscribeStorage(storageKey, onChange),
    () => readRaw(storageKey),
    () => "null",
  );

  const selectedIds = useMemo(() => parseSelected(raw), [raw]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const atMax = selectedIds.length >= MAX_DASHBOARD_KPIS;

  const isSelected = useCallback(
    (id: DashboardKpiId) => selectedSet.has(id),
    [selectedSet],
  );

  const setSelected = useCallback(
    (id: DashboardKpiId, selected: boolean) => {
      if (!(DASHBOARD_KPI_IDS as readonly string[]).includes(id)) return;
      const current = parseSelected(readRaw(storageKey));
      const next = new Set(current);
      if (selected) {
        if (next.has(id)) return;
        if (next.size >= MAX_DASHBOARD_KPIS) return;
        next.add(id);
      } else {
        next.delete(id);
      }
      writeSelected(
        storageKey,
        DASHBOARD_KPI_IDS.filter((kpiId) => next.has(kpiId)),
      );
    },
    [storageKey],
  );

  const resetToDefaults = useCallback(() => {
    writeSelected(storageKey, [...DEFAULT_DASHBOARD_KPI_IDS]);
  }, [storageKey]);

  return {
    catalog: DASHBOARD_KPI_CATALOG,
    selectedIds,
    isSelected,
    setSelected,
    resetToDefaults,
    atMax,
    maxCount: MAX_DASHBOARD_KPIS,
    selectedCount: selectedIds.length,
  };
}
