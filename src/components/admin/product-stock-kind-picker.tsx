import {
  PRODUCT_STOCK_KIND_DESCRIPTIONS,
  PRODUCT_STOCK_KIND_LABELS,
  PRODUCT_STOCK_KIND_OPTIONS,
} from "@/lib/stock-product-kind-labels";
import type { ProductStockKindValue } from "@/lib/stock-product-kind-shared";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export function ProductStockKindPicker({
  value,
  onChange,
  disabled,
  name,
}: {
  value: ProductStockKindValue;
  onChange: (value: ProductStockKindValue) => void;
  disabled?: boolean;
  /** Groups radio inputs for forms (e.g. product edit row). */
  name?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de stock"
      className="grid gap-3 lg:grid-cols-3"
    >
      {PRODUCT_STOCK_KIND_OPTIONS.map((kind) => {
        const selected = value === kind;
        const inputId = name ? `${name}-${kind}` : `product-stock-kind-${kind}`;
        return (
          <label
            key={kind}
            htmlFor={inputId}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
              selected
                ? "border-[var(--brand-primary)]/35 bg-[var(--brand-primary-soft)]/40"
                : "border-neutral-200 bg-neutral-50/60 hover:border-neutral-300",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              id={inputId}
              type="radio"
              name={name ?? "product-stock-kind"}
              value={kind}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(kind)}
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]",
                FOCUS_BRAND_BORDER,
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-neutral-900">
                {PRODUCT_STOCK_KIND_LABELS[kind]}
              </p>
              <p className="text-xs leading-relaxed text-neutral-600">
                {PRODUCT_STOCK_KIND_DESCRIPTIONS[kind]}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
