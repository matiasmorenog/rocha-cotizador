"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TableColumnDef } from "@/hooks/use-table-column-visibility";
import {
  QUOTE_PICKER_FLOAT_MS,
  useExitPresence,
} from "@/hooks/use-exit-presence";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

type Props = {
  columns: readonly TableColumnDef[];
  isVisible: (id: string) => boolean;
  onChange: (id: string, visible: boolean) => void;
  onShowAll: () => void;
  hiddenCount: number;
  className?: string;
};

/**
 * Compact "Columnas" checklist for admin tables with horizontal overflow.
 * Toggleable columns only — locked anchors (Código / Nombre) stay out.
 * Open/close uses the same float enter/exit as quote pickers.
 */
export function TableColumnPicker({
  columns,
  isVisible,
  onChange,
  onShowAll,
  hiddenCount,
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

  if (columns.length === 0) return null;

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
        <Columns3 className="size-3.5 shrink-0" aria-hidden />
        Columnas
        {hiddenCount > 0 ? (
          <span className="rounded bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600">
            −{hiddenCount}
          </span>
        ) : null}
      </Button>

      {present ? (
        <div
          key={animKey}
          id={listId}
          role="dialog"
          aria-label="Columnas visibles"
          aria-hidden={exiting || undefined}
          className={cn(
            "absolute right-0 z-40 mt-1 w-[min(100vw-2rem,16rem)] rounded-md border border-neutral-200 bg-white p-2 shadow-md",
            exiting ? "quote-picker-float-exit" : "quote-picker-float-enter",
            exiting && "pointer-events-none",
          )}
        >
          <p className="px-1.5 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            Mostrar u ocultar
          </p>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {columns.map((col) => {
              const checked = isVisible(col.id);
              return (
                <li key={col.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50",
                      FOCUS_BRAND_OUTLINE,
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--brand-primary)]"
                      checked={checked}
                      onChange={(e) => onChange(col.id, e.target.checked)}
                    />
                    <span className="min-w-0 truncate">{col.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {hiddenCount > 0 ? (
            <div className="mt-1 border-t border-neutral-100 pt-1">
              <button
                type="button"
                className={cn(
                  "w-full rounded-md px-1.5 py-1.5 text-left text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]",
                  FOCUS_BRAND_OUTLINE,
                )}
                onClick={() => {
                  onShowAll();
                }}
              >
                Mostrar todas
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
