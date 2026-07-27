/**
 * WhatsApp helpers (wa.me only — no Meta Cloud / Business API).
 *
 * Argentina only: country code `+54` is fixed in admin UI.
 * Mobile for wa.me: `54` + `9` + area + number → e.g. `5491166904442`.
 */

export const DEFAULT_WHATSAPP_NOTIFY_DIGITS = "5491166904442";

/** Display after fixed `+54`: `9 11-6690-4442`. */
export const DEFAULT_WHATSAPP_NOTIFY_LOCAL = "9 11-6690-4442";

/**
 * Strip spaces/dashes/punctuation to digits and ensure AR mobile country form for wa.me.
 *
 * Rules:
 * - Leading trunk `0` removed.
 * - Local 10-digit `11…` → `54911…`
 * - Local 10-digit `15…` (old BA mobile) → `54911…` + rest
 * - `54` + 10 local digits without mobile `9` → insert `9` after `54`
 * - Already `549…` kept as-is
 * - Local `9` + 10 digits → prefix `54`
 */
export function normalizeWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  if (!digits) return null;

  if (!digits.startsWith("54")) {
    if (digits.length === 10 && digits.startsWith("15")) {
      digits = `54911${digits.slice(2)}`;
    } else if (digits.length === 10 && digits.startsWith("11")) {
      digits = `549${digits}`;
    } else if (digits.length === 10) {
      digits = `549${digits}`;
    } else if (digits.length === 11 && digits.startsWith("9")) {
      digits = `54${digits}`;
    }
  } else {
    const rest = digits.slice(2);
    if (rest.length === 10 && !rest.startsWith("9")) {
      digits = `549${rest}`;
    }
  }

  if (digits.length < 10) return null;
  return digits;
}

/**
 * Format wa.me digits for the admin local input (without `+54`).
 * `5491166904442` → `9 11-6690-4442`
 */
export function formatWhatsAppLocalDisplay(phone: string): string {
  const digits = normalizeWhatsAppDigits(phone);
  if (!digits) return "";

  const rest = digits.startsWith("54") ? digits.slice(2) : digits;
  if (rest.startsWith("9") && rest.length >= 1) {
    const afterNine = rest.slice(1);
    let out = "9";
    if (afterNine.length > 0) out += ` ${afterNine.slice(0, 2)}`;
    if (afterNine.length > 2) out += `-${afterNine.slice(2, 6)}`;
    if (afterNine.length > 6) out += `-${afterNine.slice(6, 10)}`;
    return out;
  }

  if (rest.length === 10) {
    return `${rest.slice(0, 2)}-${rest.slice(2, 6)}-${rest.slice(6)}`;
  }

  return rest;
}

/**
 * As-you-type mask for the local field (Argentina mobile after fixed +54).
 * Accepts paste of full `54…` / `+54…` and strips country code.
 */
export function maskWhatsAppLocalInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  d = d.slice(0, 11);

  if (!d) return "";

  if (d.startsWith("9")) {
    const body = d.slice(1);
    let out = "9";
    if (body.length > 0) out += ` ${body.slice(0, 2)}`;
    if (body.length > 2) out += `-${body.slice(2, 6)}`;
    if (body.length > 6) out += `-${body.slice(6, 10)}`;
    return out;
  }

  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
}

/**
 * Build a WhatsApp chat URL from a phone string (Argentina-oriented).
 * Accepts dashed/spaced display forms (e.g. `11-3637-6383`); strips non-digits.
 * Returns null when there are no usable digits.
 */
export function whatsappUrl(phone: string, text?: string): string | null {
  const digits = normalizeWhatsAppDigits(phone);
  if (!digits) return null;

  const base = `https://wa.me/${digits}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim())}`;
}

export type QuoteWhatsAppMessageInput = {
  quoteNumber: string;
  customerCode: string;
  customerName: string;
  totalLabel: string;
  notes?: string | null;
  deliveryDate?: Date | null;
  remitoUrl: string;
};

/** Compact Spanish message for warehouse/office after quote confirm. */
export function buildQuoteWhatsAppMessage(input: QuoteWhatsAppMessageInput): string {
  const lines = [
    `Nueva cotización ${input.quoteNumber}`,
    `Cliente: ${input.customerCode} — ${input.customerName}`,
    `Total: ${input.totalLabel}`,
  ];
  if (input.deliveryDate) {
    const label = input.deliveryDate.toLocaleDateString("es-AR", {
      timeZone: "UTC",
    });
    lines.push(`Entrega: ${label}`);
  }
  const notes = input.notes?.trim();
  if (notes) {
    lines.push(`Obs: ${notes}`);
  }
  lines.push(`Remito: ${input.remitoUrl}`);
  return lines.join("\n");
}
