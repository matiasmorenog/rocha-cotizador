/**
 * Trailing "(note)" on customer names — admin-only clarification split from display name.
 */

export type ParsedCustomerNameNote = {
  name: string;
  nameNote: string;
};

/**
 * Extract a trailing balanced parenthetical from the end of a name.
 * "AMODIL (German)" → { name: "AMODIL", nameNote: "German" }
 * "AMODIL (German (Jr))" → { name: "AMODIL", nameNote: "German (Jr)" }
 * Returns null when there is no valid trailing note (empty parens, name-only parens, etc.).
 */
export function parseTrailingNameNote(
  raw: string,
): ParsedCustomerNameNote | null {
  const trimmed = raw.trim();
  if (!trimmed.endsWith(")")) return null;

  let depth = 0;
  let openIndex = -1;

  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i];
    if (ch === ")") depth++;
    else if (ch === "(") {
      depth--;
      if (depth === 0) {
        openIndex = i;
        break;
      }
    }
  }

  if (openIndex <= 0) return null;

  const nameNote = trimmed.slice(openIndex + 1, -1).trim();
  if (!nameNote) return null;

  const name = trimmed.slice(0, openIndex).trim();
  if (!name) return null;

  return { name, nameNote };
}

export function emptyToNullNameNote(
  v: string | null | undefined,
): string | null {
  const t = (v ?? "").trim();
  return t || null;
}
