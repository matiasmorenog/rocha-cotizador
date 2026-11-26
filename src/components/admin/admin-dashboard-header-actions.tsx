"use client";

import Link from "next/link";
import { ClipboardPlus } from "lucide-react";
import { AdminDashboardKpiPicker } from "@/components/admin/admin-dashboard-kpi-picker";
import { useDashboardKpiSelection } from "@/hooks/use-dashboard-kpi-selection";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

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
      <Link
        href="/admin/cotizaciones/nueva"
        className={cn(
          "inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white shadow-sm hover:opacity-90",
          FOCUS_BRAND_PRIMARY,
        )}
      >
        <ClipboardPlus className="mr-1.5 h-4 w-4" aria-hidden />
        Nueva cotización
      </Link>
    </div>
  );
}
