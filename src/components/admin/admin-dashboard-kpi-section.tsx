"use client";

import { AnimatedCount } from "@/components/ui/animated-count";
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

/** Match `.admin-dashboard-kpi-stagger` delays so digits start as the card enters. */
const KPI_STAGGER_MS = 55;
const KPI_COUNT_BASE_DELAY_MS = 90;

/**
 * Client KPI grid (max 3). Picker lives in the page header next to
 * Nueva cotización; selection syncs via the same localStorage hook.
 */
export function AdminDashboardKpiSection({ values, userId }: Props) {
  const { selectedIds, maxCount } = useDashboardKpiSelection(userId);

  const labelById = new Map(
    DASHBOARD_KPI_CATALOG.map((kpi) => [kpi.id, kpi.label] as const),
  );

  if (selectedIds.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        Ninguna métrica seleccionada. Abrí <span className="font-medium">Métricas</span>{" "}
        y elegí hasta {maxCount}.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "admin-dashboard-kpi-stagger grid gap-3",
        selectedIds.length === 1 && "sm:grid-cols-1",
        selectedIds.length === 2 && "sm:grid-cols-2",
        selectedIds.length >= 3 && "sm:grid-cols-3",
      )}
    >
      {selectedIds.map((id: DashboardKpiId, index) => {
        const display = values[id];
        const numeric =
          typeof display.value === "number"
            ? display.value
            : Number(display.value);
        const canTween = Number.isFinite(numeric);

        return (
          <div
            key={id}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {labelById.get(id) ?? id}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900">
              {canTween ? (
                <AnimatedCount
                  value={numeric}
                  delayMs={KPI_COUNT_BASE_DELAY_MS + index * KPI_STAGGER_MS}
                />
              ) : (
                display.value
              )}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{display.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
