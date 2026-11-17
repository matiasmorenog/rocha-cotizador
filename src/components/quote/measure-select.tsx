"use client";

import { AppSelect } from "@/components/ui/app-select";

export type MeasureValue = "kg" | "unit";

const OPTIONS: { value: MeasureValue; label: string }[] = [
  { value: "kg", label: "Kg" },
  { value: "unit", label: "Unidades" },
];

type Props = {
  id?: string;
  value: MeasureValue;
  onChange: (value: MeasureValue) => void;
  /** Form field (h-10) vs draft row (h-8). */
  size?: "md" | "sm";
  "aria-label"?: string;
  className?: string;
};

/** Thin wrapper — measure toggle uses shared {@link AppSelect}. */
export function MeasureSelect({
  id,
  value,
  onChange,
  size = "md",
  "aria-label": ariaLabel = "Medida",
  className,
}: Props) {
  return (
    <AppSelect
      id={id}
      value={value}
      onChange={onChange}
      options={OPTIONS}
      size={size}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
