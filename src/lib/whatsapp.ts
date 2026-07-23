/**
 * WhatsApp helpers (wa.me only — no Meta Cloud / Business API).
 *
 * Argentina mobile for wa.me usually needs country + mobile prefix:
 * `54` + `9` + area + number → e.g. `5491166904442`.
 */

export const DEFAULT_WHATSAPP_NOTIFY_DIGITS = "5491166904442";

/**
 * Strip spaces/dashes/punctuation to digits and ensure AR mobile country form for wa.me.
 *
 * Rules:
 * - Leading trunk `0` removed.
 * - Local 10-digit `11…` → `54911…`
 * - Local 10-digit `15…` (old BA mobile) → `54911…` + rest
 * - `54` + 10 local digits without mobile `9` → insert `9` after `54`
 * - Already `549…` kept as-is
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
      // Other AR area codes: assume mobile → 54 9 + local
      digits = `549${digits}`;
    }
  } else {
    const rest = digits.slice(2);
    // 54 + AA + 8 digits (no mobile 9) → insert 9 for wa.me mobile
    if (rest.length === 10 && !rest.startsWith("9")) {
      digits = `549${rest}`;
    }
  }

  if (digits.length < 10) return null;
  return digits;
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
  remitoUrl: string;
};

/** Compact Spanish message for warehouse/office after quote confirm. */
export function buildQuoteWhatsAppMessage(input: QuoteWhatsAppMessageInput): string {
  const lines = [
    `Nueva cotización ${input.quoteNumber}`,
    `Cliente: ${input.customerCode} — ${input.customerName}`,
    `Total: ${input.totalLabel}`,
  ];
  const notes = input.notes?.trim();
  if (notes) {
    lines.push(`Obs: ${notes}`);
  }
  lines.push(`Remito: ${input.remitoUrl}`);
  return lines.join("\n");
}
