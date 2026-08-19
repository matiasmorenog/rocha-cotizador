"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

const OTHER_VALUE = "__other__";

function matchKnown(rubros: string[], value: string): string | null {
  const t = value.trim().toLowerCase();
  if (!t) return null;
  return rubros.find((r) => r.toLowerCase() === t) ?? null;
}

/**
 * Tipo = Product.rubro. Select from cached DISTINCT list, or "Otro / nuevo…" + text.
 */
export function ProductTipoField({
  rubros,
  value,
  onChange,
  form,
  disabled,
  required,
  id = "product-tipo",
  compact,
}: {
  rubros: string[];
  value: string;
  onChange: (rubro: string) => void;
  form?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /** Inline table edit: smaller controls, no Label. */
  compact?: boolean;
}) {
  const knownMatch = useMemo(
    () => matchKnown(rubros, value),
    [rubros, value],
  );
  const [otherMode, setOtherMode] = useState(
    () => Boolean(value.trim()) && !matchKnown(rubros, value),
  );

  const selectValue = otherMode ? OTHER_VALUE : (knownMatch ?? "");

  function onSelectChange(next: string) {
    if (next === OTHER_VALUE) {
      setOtherMode(true);
      if (knownMatch) onChange("");
      return;
    }
    setOtherMode(false);
    onChange(next);
  }

  const selectClass = cn(
    compact
      ? "h-8 min-w-[7rem] rounded-md border border-neutral-200 bg-white px-2 text-sm"
      : "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm",
    FOCUS_BRAND_BORDER,
  );

  return (
    <div className={cn("space-y-1", compact && "min-w-[8rem]")}>
      {compact ? null : <Label htmlFor={id}>Tipo</Label>}
      <select
        id={id}
        form={form}
        className={selectClass}
        value={selectValue}
        onChange={(e) => onSelectChange(e.target.value)}
        disabled={disabled}
        required={required && !otherMode}
        aria-label="Tipo"
      >
        <option value="">{compact ? "—" : "Sin tipo"}</option>
        {rubros.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
        <option value={OTHER_VALUE}>Otro / nuevo…</option>
      </select>
      {otherMode ? (
        <Input
          form={form}
          className={compact ? "h-8 min-w-[7rem] px-2 text-sm" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          placeholder="Nuevo tipo"
          aria-label="Nuevo tipo"
        />
      ) : null}
    </div>
  );
}
