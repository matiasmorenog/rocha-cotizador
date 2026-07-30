import { foldSearchText, looksLikeCodeQuery } from "@/lib/search-fold";

export { looksLikeCodeQuery } from "@/lib/search-fold";

/**
 * Client catalog search index — char trigrams over folded codeLower + nameLower.
 *
 * Semantics: case- and accent-insensitive substring on code OR name (`ñ` kept
 * distinct — see `foldSearchText`). Trigrams prune candidates; `includes` verifies.
 *
 * Code-first: when the needle looks like a SKU (digits / compact alnum with a
 * digit), hits rank as code prefix → code substring → name substring so typed
 * codes float above name noise. Name/word queries keep flat catalog order.
 *
 * Complexity (n = catalog size, L ≈ avg code+name length, c = candidates):
 * - Build: O(n · L)
 * - Query (needle length < 3): O(n) scan; code-first can early-exit when prefix tier fills `take`
 * - Query (needle length >= 3): O(c) after posting intersect; rank then slice `take`
 */

export type SearchableProduct = {
  /** Folded search key (lowercase + accents stripped; ñ kept). */
  codeLower: string;
  /** Folded search key (lowercase + accents stripped; ñ kept). */
  nameLower: string;
};

export type ProductSearchIndex<T extends SearchableProduct = SearchableProduct> = {
  items: readonly T[];
  /** Contiguous 3-char grams → ascending unique item indices. */
  posting: ReadonlyMap<string, readonly number[]>;
};

const TRIGRAM = 3;

export const EMPTY_PRODUCT_SEARCH_INDEX: ProductSearchIndex<SearchableProduct> = {
  items: [],
  posting: new Map(),
};

function addFieldTrigrams(
  posting: Map<string, number[]>,
  text: string,
  idx: number,
): void {
  if (text.length < TRIGRAM) return;
  for (let i = 0; i <= text.length - TRIGRAM; i++) {
    const gram = text.slice(i, i + TRIGRAM);
    const list = posting.get(gram);
    if (!list) {
      posting.set(gram, [idx]);
    } else if (list[list.length - 1] !== idx) {
      list.push(idx);
    }
  }
}

/** Build once when catalog hydrates / changes. Sync; fine for thousands of SKUs. */
export function buildProductSearchIndex<T extends SearchableProduct>(
  items: readonly T[],
): ProductSearchIndex<T> {
  const posting = new Map<string, number[]>();
  for (let i = 0; i < items.length; i++) {
    const p = items[i]!;
    addFieldTrigrams(posting, p.codeLower, i);
    addFieldTrigrams(posting, p.nameLower, i);
  }
  return { items, posting };
}

/**
 * Code-first buckets (catalog order within each tier).
 * Early-exit only when prefix tier alone fills `take`.
 */
function collectCodeFirst<T extends SearchableProduct>(
  items: readonly T[],
  needle: string,
  take: number,
): T[] {
  const prefix: T[] = [];
  const codeSub: T[] = [];
  const nameOnly: T[] = [];

  for (const p of items) {
    if (p.codeLower.startsWith(needle)) {
      prefix.push(p);
      if (prefix.length >= take) break;
      continue;
    }
    if (p.codeLower.includes(needle)) {
      codeSub.push(p);
      continue;
    }
    if (p.nameLower.includes(needle)) {
      nameOnly.push(p);
    }
  }

  const out: T[] = [];
  for (const bucket of [prefix, codeSub, nameOnly]) {
    for (const p of bucket) {
      out.push(p);
      if (out.length >= take) return out;
    }
  }
  return out;
}

/** Flat O(n) scan + early-exit — word queries and short needles without code-first. */
export function searchProductsLinear<T extends SearchableProduct>(
  items: readonly T[],
  needle: string,
  take: number,
): T[] {
  if (looksLikeCodeQuery(needle)) {
    return collectCodeFirst(items, needle, take);
  }

  const out: T[] = [];
  for (const p of items) {
    if (p.codeLower.includes(needle) || p.nameLower.includes(needle)) {
      out.push(p);
      if (out.length >= take) break;
    }
  }
  return out;
}

function intersectTwo(
  a: readonly number[],
  b: readonly number[],
): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const av = a[i]!;
    const bv = b[j]!;
    if (av === bv) {
      out.push(av);
      i += 1;
      j += 1;
    } else if (av < bv) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return out;
}

function intersectSortedLists(
  lists: readonly (readonly number[])[],
): number[] {
  if (lists.length === 0) return [];
  let cur: readonly number[] = lists[0]!;
  for (let i = 1; i < lists.length; i++) {
    cur = intersectTwo(cur, lists[i]!);
    if (cur.length === 0) return [];
  }
  return cur as number[];
}

/**
 * Substring search preserving catalog order (or code-first tiers), capped at `take`.
 * Needle is trimmed + folded (same fold as indexed codeLower/nameLower).
 */
export function searchProductIndex<T extends SearchableProduct>(
  index: ProductSearchIndex<T>,
  q: string,
  take = 30,
): T[] {
  const needle = foldSearchText(q.trim());
  if (!needle || take <= 0 || index.items.length === 0) return [];

  // Trigrams of length-1/2 needles don't imply substring; scan with early-exit.
  if (needle.length < TRIGRAM) {
    return searchProductsLinear(index.items, needle, take);
  }

  const gramCount = needle.length - TRIGRAM + 1;
  const lists: (readonly number[])[] = new Array(gramCount);
  for (let i = 0; i < gramCount; i++) {
    const list = index.posting.get(needle.slice(i, i + TRIGRAM));
    if (!list || list.length === 0) return [];
    lists[i] = list;
  }

  lists.sort((a, b) => a.length - b.length);
  const candidates = intersectSortedLists(lists);

  if (looksLikeCodeQuery(needle)) {
    const candidateItems: T[] = new Array(candidates.length);
    for (let i = 0; i < candidates.length; i++) {
      candidateItems[i] = index.items[candidates[i]!]!;
    }
    return collectCodeFirst(candidateItems, needle, take);
  }

  const out: T[] = [];
  for (const idx of candidates) {
    const p = index.items[idx]!;
    if (p.codeLower.includes(needle) || p.nameLower.includes(needle)) {
      out.push(p);
      if (out.length >= take) break;
    }
  }
  return out;
}
