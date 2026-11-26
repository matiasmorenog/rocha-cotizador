"use client";

import { AdminDashboardKpiPicker } from "@/components/admin/admin-dashboard-kpi-picker";
import {
  AdminNewQuoteTrigger,
  useAdminNewQuoteTriggerState,
} from "@/components/admin/admin-new-quote-modal";
import { useDashboardKpiSelection } from "@/hooks/use-dashboard-kpi-selection";

type Props = {
  canQuotes: boolean;
  userId?: string | null;
};

/**
 * Dashboard title-row actions: KPI picker + Nueva cotización (same row).
 */
export function AdminDashboardHeaderActions({ canQuotes, userId }: Props) {
  const {
    catalog,
    isSelected,
    setSelected,
    resetToDefaults,
    atMax,
    maxCount,
    selectedCount,
  } = useDashboardKpiSelection(userId);
  const quoteTrigger = useAdminNewQuoteTriggerState();

  if (!canQuotes) return null;

  return (
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
      <AdminNewQuoteTrigger
        pending={quoteTrigger.pending}
        itemCount={quoteTrigger.itemCount}
        onClick={quoteTrigger.toggle}
      />
    </div>
  );
}
