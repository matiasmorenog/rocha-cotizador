"use client";

import {
  type FocusEvent,
  type InputHTMLAttributes,
  forwardRef,
  useEffect,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import {
  formatArInput,
  parseArNumber,
  sanitizeArNumberInput,
  type FormatArInputOptions,
} from "@/lib/utils";

/** Prices: `2.300,00` on blur. Stable ref for effect deps. */
export const AR_PRICE_FORMAT: FormatArInputOptions = {
  useGrouping: true,
  minFractionDigits: 2,
};

type SharedProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode" | "defaultValue"
> & {
  maxFractionDigits?: number;
  formatOptions?: FormatArInputOptions;
};

export type ArNumberInputProps = SharedProps & {
  /** Parent-owned raw string (free typing; parse with `parseArNumber` on submit). */
  value: string;
  onValueChange: (raw: string) => void;
  /** Reformat with `formatArInput` on blur when parseable. Default true. */
  formatOnBlur?: boolean;
};

/**
 * Text input with es-AR entry (`,` decimal, `.` thousands). Soft char filter while
 * typing; optional blur reformat. Parent keeps the string and sends JS numbers via
 * `parseArNumber`.
 */
export const ArNumberInput = forwardRef<HTMLInputElement, ArNumberInputProps>(
  function ArNumberInput(
    {
      value,
      onValueChange,
      maxFractionDigits = 3,
      formatOptions,
      formatOnBlur = true,
      onBlur,
      ...props
    },
    ref,
  ) {
    function reformat() {
      if (!formatOnBlur) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      const n = parseArNumber(trimmed);
      if (!Number.isFinite(n)) return;
      onValueChange(formatArInput(n, maxFractionDigits, formatOptions));
    }

    return (
      <Input
        ref={ref}
        {...props}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onValueChange(sanitizeArNumberInput(e.target.value))}
        onBlur={(e: FocusEvent<HTMLInputElement>) => {
          reformat();
          onBlur?.(e);
        }}
      />
    );
  },
);

export type ArNumberValueInputProps = SharedProps & {
  /** Number from store/model; local string while editing. */
  value: number;
  onValueChange: (n: number) => void;
  /** Skip pushing incomplete mid-edit values (e.g. `2,`). Default: only finite. */
  min?: number;
};

/**
 * Number-backed AR input (draft qty rows). Syncs finite parses up; reformats on blur.
 */
export const ArNumberValueInput = forwardRef<
  HTMLInputElement,
  ArNumberValueInputProps
>(function ArNumberValueInput(
  {
    value,
    onValueChange,
    maxFractionDigits = 3,
    formatOptions,
    min,
    onBlur,
    onFocus,
    ...props
  },
  ref,
) {
  const [text, setText] = useState(() =>
    formatArInput(value, maxFractionDigits, formatOptions),
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatArInput(value, maxFractionDigits, formatOptions));
    }
  }, [value, focused, maxFractionDigits, formatOptions]);

  function commitFromText(raw: string) {
    const n = parseArNumber(raw);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    onValueChange(n);
    setText(formatArInput(n, maxFractionDigits, formatOptions));
    return true;
  }

  return (
    <Input
      ref={ref}
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = sanitizeArNumberInput(e.target.value);
        setText(next);
        const n = parseArNumber(next);
        if (!Number.isFinite(n)) return;
        if (min !== undefined && n < min) return;
        onValueChange(n);
      }}
      onBlur={(e: FocusEvent<HTMLInputElement>) => {
        setFocused(false);
        if (!commitFromText(text)) {
          setText(formatArInput(value, maxFractionDigits, formatOptions));
        }
        onBlur?.(e);
      }}
    />
  );
});
