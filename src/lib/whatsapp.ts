/**
 * Build a WhatsApp chat URL from a phone string (Argentina-oriented).
 * Accepts dashed/spaced display forms (e.g. `11-3637-6383`); strips non-digits.
 * Returns null when there are no usable digits.
 */
export function whatsappUrl(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // AR trunk prefix (e.g. 011 …)
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  if (!digits) return null;

  if (!digits.startsWith("54")) {
    if (digits.length === 10 && digits.startsWith("15")) {
      // Local mobile 15-XXXX-XXXX → 54 9 11 XXXX-XXXX
      digits = `54911${digits.slice(2)}`;
    } else if (digits.length === 10 && digits.startsWith("11")) {
      // BA mobile 11-XXXX-XXXX → 54 9 11 XXXX-XXXX
      digits = `549${digits}`;
    }
  }

  if (digits.length < 8) return null;

  return `https://wa.me/${digits}`;
}
