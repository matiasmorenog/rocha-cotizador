import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toNumber(amount: number | string | { toNumber?: () => number; toString: () => string }) {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") return parseFloat(amount);
  if (typeof amount.toNumber === "function") return amount.toNumber();
  return parseFloat(amount.toString());
}

const arsCurrency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const arsQty = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 3,
});

export function formatPrice(
  amount: number | string | { toNumber?: () => number; toString: () => string },
) {
  return arsCurrency.format(toNumber(amount));
}

export function formatQty(
  qty: number | string | { toNumber?: () => number; toString: () => string },
) {
  return arsQty.format(toNumber(qty));
}

export type FormatArInputOptions = {
  /** Thousands separator (`.`). Off by default so mid-edit kg fields stay simple. */
  useGrouping?: boolean;
  /** Pad decimals (e.g. prices → `2.300,00`). */
  minFractionDigits?: number;
};

/**
 * Format a number for editable kg/price inputs (es-AR `,` decimal).
 * Prefer this over `String(n)` so fields show `2,35` not `2.35`.
 */
export function formatArInput(
  amount: number,
  maxFractionDigits = 3,
  options?: FormatArInputOptions,
): string {
  if (!Number.isFinite(amount)) return "";
  const clampedMax = Math.min(20, Math.max(0, maxFractionDigits));
  const minFrac = options?.minFractionDigits ?? 0;
  const clampedMin = Math.min(minFrac, clampedMax);
  return new Intl.NumberFormat("es-AR", {
    useGrouping: options?.useGrouping ?? false,
    maximumFractionDigits: clampedMax,
    minimumFractionDigits: clampedMin,
  }).format(amount);
}

/** Soft live filter: digits + `,` / `.` + optional leading `-`. */
export function sanitizeArNumberInput(raw: string): string {
  const cleaned = String(raw).replace(/[^\d.,\-]/g, "");
  const minus = cleaned.startsWith("-") ? "-" : "";
  return minus + cleaned.replace(/-/g, "");
}

/**
 * Parse user-typed kg/price for Argentina: `,` decimal, `.` thousands (and tolerate
 * plain `.` decimal paste like `2.35`). Returns `NaN` when empty/invalid.
 */
export function parseArNumber(raw: string): number {
  const s = String(raw).trim().replace(/\s/g, "").replace(/^\+/, "");
  if (!s || s === "-" || s === "," || s === ".") return NaN;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized: string;

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // 1.234,56
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    normalized =
      parts.length === 2
        ? `${parts[0].replace(/\./g, "")}.${parts[1]}`
        : parts.slice(0, -1).join("").replace(/\./g, "") +
          "." +
          parts[parts.length - 1];
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2) {
      // Single dot: decimal paste (`2.35`) or rare thousands (`1.234`).
      // Prefer decimal for kg/price fields.
      normalized = s;
    } else {
      const last = parts[parts.length - 1] ?? "";
      normalized =
        last.length <= 2
          ? parts.slice(0, -1).join("") + "." + last
          : parts.join("");
    }
  } else {
    normalized = s;
  }

  return Number(normalized);
}

export function padCustomerCode(code: string) {
  const digits = code.replace(/\D/g, "");
  return digits.padStart(3, "0").slice(-3);
}

/** Initial PIN = customer code zero-padded to 4 digits (001 → 0001). */
export function pinFromCustomerCode(code: string) {
  const digits = code.replace(/\D/g, "");
  return digits.padStart(4, "0");
}
