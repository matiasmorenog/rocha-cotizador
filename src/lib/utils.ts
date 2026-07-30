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

export function padCustomerCode(code: string) {
  const digits = code.replace(/\D/g, "");
  return digits.padStart(3, "0").slice(-3);
}

/** Initial PIN = customer code zero-padded to 4 digits (001 → 0001). */
export function pinFromCustomerCode(code: string) {
  const digits = code.replace(/\D/g, "");
  return digits.padStart(4, "0");
}
