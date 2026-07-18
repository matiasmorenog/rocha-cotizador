/**
 * Split Excel "Telefono/Contacto" values into phone, email, and contact name.
 *
 * Rules:
 * - Prefer phone digits (6+); normalize display via `normalizePhone`.
 * - If an email is present, put it in `email` (not phone).
 * - Trailing/leading alpha words after phone/email = contact name.
 * - Separators between phone and name: spaces and optional "-" / "/".
 * - If the field is only letters (e.g. "Celu Pana"), treat as contact name; phone null.
 */

export type ParsedPhoneContact = {
  phone: string | null;
  email: string | null;
  contact: string | null;
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const MIN_PHONE_DIGITS = 6;

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

function cleanContact(s: string): string | null {
  const t = s.replace(/^[\s\-/]+|[\s\-/]+$/g, "").trim();
  return t || null;
}

/**
 * Normalize a phone for DB/display (Argentina-friendly).
 *
 * - Strips to digits (leading trunk `0` removed).
 * - 10 digits → `XX-XXXX-XXXX` (e.g. `11-3637-6383`).
 * - Starts with `54` + mobile `9` + area + 8 → `+54 9 AA-XXXX-XXXX`.
 * - Starts with `54` + 10 local digits → `+54 AA-XXXX-XXXX`.
 * - Other: compact digits (or `+54 …` if country code present).
 * - Empty / no digits → null.
 */
export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  if (!digits) return null;

  if (digits.startsWith("54")) {
    return formatArInternational(digits);
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length < MIN_PHONE_DIGITS) return null;

  return digits;
}

function formatArInternational(digits: string): string {
  // digits always starts with 54
  const rest = digits.slice(2);

  // Mobile: 9 + AA + NNNNNNNN (11 digits after 54)
  if (rest.startsWith("9") && rest.length === 11) {
    const area = rest.slice(1, 3);
    const local = rest.slice(3);
    return `+54 9 ${area}-${local.slice(0, 4)}-${local.slice(4)}`;
  }

  // Local without mobile 9: AA + NNNNNNNN
  if (rest.length === 10) {
    const area = rest.slice(0, 2);
    const local = rest.slice(2);
    return `+54 ${area}-${local.slice(0, 4)}-${local.slice(4)}`;
  }

  if (!rest) return "+54";
  return `+54 ${rest}`;
}

/** Parse phone + contact from a string that has no email left. */
function parsePhoneAndContact(input: string): {
  phone: string | null;
  contact: string | null;
} {
  if (!input) return { phone: null, contact: null };

  // Phone (digits + phone punctuation) then optional separator then name words
  const phoneThenName = input.match(
    /^([+\d][\d\s\-().]*)(?:\s*[-/]?\s+|\s+)([A-Za-zÁÉÍÓÚÜáéíóúüÑñ][A-Za-zÁÉÍÓÚÜáéíóúüÑñ\s.]*)$/u,
  );
  if (phoneThenName) {
    const phonePart = phoneThenName[1].trim().replace(/[\s\-/]+$/g, "").trim();
    const contact = cleanContact(phoneThenName[2]);
    if (digitCount(phonePart) >= MIN_PHONE_DIGITS && contact) {
      return { phone: normalizePhone(phonePart), contact };
    }
  }

  // Leading phone chunk, remainder = contact
  const leadingPhone = input.match(/^([+\d][\d\s\-().]+)/);
  if (leadingPhone) {
    const phonePart = leadingPhone[1].trim().replace(/[\s\-/]+$/g, "").trim();
    if (digitCount(phonePart) >= MIN_PHONE_DIGITS) {
      const rest = cleanContact(input.slice(leadingPhone[0].length));
      return { phone: normalizePhone(phonePart), contact: rest };
    }
  }

  // Digits-only-ish phone, no name
  if (digitCount(input) >= MIN_PHONE_DIGITS && /^[+\d][\d\s\-().]*$/.test(input)) {
    return { phone: normalizePhone(input), contact: null };
  }

  // Short numeric / punctuation only — keep as phone (normalized)
  if (/^[\d\s\-()+.]+$/.test(input)) {
    return { phone: normalizePhone(input), contact: null };
  }

  // Letters only (e.g. "Celu Pana") — contact name, no phone
  if (/^[A-Za-zÁÉÍÓÚÜáéíóúüÑñ\s.]+$/u.test(input)) {
    return { phone: null, contact: input };
  }

  return { phone: input, contact: null };
}

export function parsePhoneContact(
  raw: string | null | undefined,
): ParsedPhoneContact {
  if (!raw) return { phone: null, email: null, contact: null };
  const input = raw.trim().replace(/\s+/g, " ");
  if (!input) return { phone: null, email: null, contact: null };

  const emailMatch = input.match(EMAIL_RE);
  if (emailMatch) {
    const email = emailMatch[0];
    const remainder = cleanContact(input.replace(email, "")) ?? "";
    const { phone, contact } = parsePhoneAndContact(remainder);
    return { phone, email, contact };
  }

  const { phone, contact } = parsePhoneAndContact(input);
  return { phone, email: null, contact };
}

/** Append `(Contact)` to name unless that contact already appears in parentheses. */
export function appendContactToName(name: string, contact: string): string {
  const c = contact.trim();
  if (!c) return name;
  const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\(\\s*${escaped}\\s*\\)`, "i").test(name)) {
    return name;
  }
  return `${name.trim()} (${c})`;
}
