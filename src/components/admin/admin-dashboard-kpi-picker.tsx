"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  QUOTE_PICKER_FLOAT_MS,
  useExitPresence,
} from "@/hooks/use-exit-presence";
import type { DashboardKpiDef, DashboardKpiId } from "@/lib/admin-dashboard-kpi-catalog";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

type Props = {
  catalog: readonly DashboardKpiDef[];
  isSelected: (id: DashboardKpiId) => boolean;
  onChange: (id: DashboardKpiId, selected: boolean) => void;
  onResetDefaults: () => void;
  selectedCount: number;
  maxCount: number;
  atMax: boolean;
  className?: string;
};

/**
 * Checklist to pick up to `maxCount` dashboard KPIs.
 * Same float/checklist UX as `TableColumnPicker` (Columnas).
 */
export function AdminDashboardKpiPicker({
  catalog,
  isSelected,
  onChange,
  onResetDefaults,
  selectedCount,
  maxCount,
  atMax,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const { present, exiting, animKey } = useExitPresence(
    open,
    QUOTE_PICKER_FLOAT_MS,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
        Métricas
        <span className="rounded bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600">
          {selectedCount}/{maxCount}
        </span>
      </Button>

      {present ? (
        <div
          key={animKey}
          id={listId}
          role="dialog"
          aria-label="Métricas del dashboard"
          aria-hidden={exiting || undefined}
          className={cn(
            "absolute right-0 z-40 mt-1 w-[min(100vw-2rem,18rem)] rounded-md border border-neutral-200 bg-white p-2 shadow-md",
            exiting ? "quote-picker-float-exit" : "quote-picker-float-enter",
            exiting && "pointer-events-none",
          )}
        >
          <p className="px-1.5 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            Hasta {maxCount} métricas
          </p>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {catalog.map((kpi) => {
              const checked = isSelected(kpi.id);
              const disabled = !checked && atMax;
              return (
                <li key={kpi.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50",
                      disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                      FOCUS_BRAND_OUTLINE,
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 shrink-0 accent-[var(--brand-primary)]"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => onChange(kpi.id, e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{kpi.label}</span>
                      <span className="block text-[10px] leading-snug text-neutral-500">
                        {kpi.pickerHint}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 border-t border-neutral-100 pt-1">
            <button
              type="button"
              className={cn(
                "w-full rounded-md px-1.5 py-1.5 text-left text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]",
                FOCUS_BRAND_OUTLINE,
              )}
              onClick={() => {
                onResetDefaults();
              }}
            >
              Restablecer (3 por defecto)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
