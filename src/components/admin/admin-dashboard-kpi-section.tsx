"use client";

import { AdminDashboardKpiPicker } from "@/components/admin/admin-dashboard-kpi-picker";
import { useDashboardKpiSelection } from "@/hooks/use-dashboard-kpi-selection";
import {
  DASHBOARD_KPI_CATALOG,
  type DashboardKpiId,
  type DashboardKpiValues,
} from "@/lib/admin-dashboard-kpi-catalog";
import { cn } from "@/lib/utils";

type Props = {
  values: DashboardKpiValues;
  userId?: string | null;
};

/**
 * Client KPI grid + picker (max 3, localStorage). Values come from one
 * cached server fetch of the full catalog.
 */
export function AdminDashboardKpiSection({ values, userId }: Props) {
  const {
    catalog,
    selectedIds,
    isSelected,
    setSelected,
    resetToDefaults,
    atMax,
    maxCount,
    selectedCount,
  } = useDashboardKpiSelection(userId);

  const labelById = new Map(
    DASHBOARD_KPI_CATALOG.map((kpi) => [kpi.id, kpi.label] as const),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AdminDashboardKpiPicker
          catalog={catalog}
          isSelected={isSelected}
          onChange={setSelected}
          onResetDefaults={resetToDefaults}
          selectedCount={selectedCount}
          maxCount={maxCount}
          atMax={atMax}
        />
      </div>

      {selectedIds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          Ninguna métrica seleccionada. Abrí <span className="font-medium">Métricas</span>{" "}
          y elegí hasta {maxCount}.
        </p>
      ) : (
        <div
          className={cn(
            "admin-dashboard-kpi-stagger grid gap-3",
            selectedIds.length === 1 && "sm:grid-cols-1",
            selectedIds.length === 2 && "sm:grid-cols-2",
            selectedIds.length >= 3 && "sm:grid-cols-3",
          )}
        >
          {selectedIds.map((id: DashboardKpiId) => {
            const display = values[id];
            return (
              <div
                key={id}
                className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  {labelById.get(id) ?? id}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900">
                  {display.value}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{display.hint}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
