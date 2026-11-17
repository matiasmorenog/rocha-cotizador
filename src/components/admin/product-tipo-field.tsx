"use client";

import { useMemo, useState } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div className={cn("space-y-1", compact && "min-w-[8rem]")}>
      {compact ? null : <Label htmlFor={id}>Tipo</Label>}
      <AppSelect
        id={id}
        form={form}
        value={selectValue}
        onChange={onSelectChange}
        disabled={disabled}
        required={required && !otherMode}
        size={compact ? "sm" : "md"}
        searchable
        searchPlaceholder="Buscar tipo…"
        aria-label="Tipo"
        options={[
          { value: "", label: compact ? "—" : "Sin tipo" },
          ...rubros.map((r) => ({ value: r, label: r })),
          { value: OTHER_VALUE, label: "Otro / nuevo…" },
        ]}
      />
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
