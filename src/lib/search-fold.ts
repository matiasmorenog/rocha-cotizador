/**
 * Shared search text fold + lightweight code/name filter for client catalogs.
 *
 * Fold: lowercase → protect `ñ` → NFD → strip combining marks → restore `ñ`.
 * Spanish `ñ` (U+00F1) stays distinct (raw NFD+strip would map ñ→n).
 * Acute/grave/diaeresis/circumflex fold away as usual.
 */

export function foldSearchText(input: string): string {
  // Placeholder must survive NFD + mark strip (ASCII control works).
  const protected_ = input.toLowerCase().replaceAll("ñ", "\0");
  return protected_
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("\0", "ñ");
}

/**
 * True when the folded needle is code/SKU-like (users often type codes).
 * Pure digits, or compact token that contains a digit (no spaces).
 * Word queries like "jamon" stay false → flat includes order.
 */
export function looksLikeCodeQuery(needle: string): boolean {
  if (!needle || /\s/.test(needle)) return false;
  if (/^\d+$/.test(needle)) return true;
  return /\d/.test(needle) && /^[a-z0-9._-]+$/.test(needle);
}

export type SearchFieldAccessor<T> = (
  item: T,
) => string | null | undefined;

export type FilterFoldedSearchOptions<T> = {
  /** Code-like fields (SKU, customer code, quote number) — ranked first for code queries. */
  primary: SearchFieldAccessor<T>[];
  /** Name / free-text fields (and extras like rubro). */
  secondary?: SearchFieldAccessor<T>[];
  take?: number;
  /** Admin tables: empty query returns all. Pickers: return []. Default false. */
  emptyReturnsAll?: boolean;
};

function foldedField<T>(
  item: T,
  acc: SearchFieldAccessor<T>,
): string {
  const v = acc(item);
  if (v == null || v === "") return "";
  return foldSearchText(String(v));
}

/**
 * Folded substring filter. Code-like needles rank:
 * primary prefix → primary substring → secondary substring (order preserved in each tier).
 * Word needles: any primary/secondary includes, original order, early-exit at `take`.
 */
export function filterFoldedSearch<T>(
  items: readonly T[],
  q: string,
  opts: FilterFoldedSearchOptions<T>,
): T[] {
  const needle = foldSearchText(q.trim());
  if (!needle) {
    if (!opts.emptyReturnsAll) return [];
    const take = opts.take;
    return take != null && take < items.length
      ? items.slice(0, take)
      : [...items];
  }

  const primary = opts.primary;
  const secondary = opts.secondary ?? [];
  const take = opts.take ?? Number.POSITIVE_INFINITY;

  if (looksLikeCodeQuery(needle)) {
    const prefix: T[] = [];
    const primarySub: T[] = [];
    const secondaryHits: T[] = [];

    for (const item of items) {
      let isPrefix = false;
      let primaryIncludes = false;
      for (const acc of primary) {
        const f = foldedField(item, acc);
        if (!f) continue;
        if (f.startsWith(needle)) {
          isPrefix = true;
          break;
        }
        if (f.includes(needle)) primaryIncludes = true;
      }

      if (isPrefix) {
        prefix.push(item);
        if (prefix.length >= take) break;
        continue;
      }
      if (primaryIncludes) {
        primarySub.push(item);
        continue;
      }

      for (const acc of secondary) {
        const f = foldedField(item, acc);
        if (f && f.includes(needle)) {
          secondaryHits.push(item);
          break;
        }
      }
    }

    const out: T[] = [];
    for (const bucket of [prefix, primarySub, secondaryHits]) {
      for (const item of bucket) {
        out.push(item);
        if (out.length >= take) return out;
      }
    }
    return out;
  }

  const fields = [...primary, ...secondary];
  const out: T[] = [];
  for (const item of items) {
    let hit = false;
    for (const acc of fields) {
      const f = foldedField(item, acc);
      if (f && f.includes(needle)) {
        hit = true;
        break;
      }
    }
    if (hit) {
      out.push(item);
      if (out.length >= take) break;
    }
  }
  return out;
}
