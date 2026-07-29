/**
 * Client catalog search index — char trigrams over codeLower + nameLower.
 *
 * Semantics match legacy linear filter: case-insensitive substring on code OR name
 * (no accent folding). Trigrams prune candidates; `includes` verifies.
 *
 * Complexity (n = catalog size, L ≈ avg code+name length, c = candidates):
 * - Build: O(n · L)
 * - Query (needle length < 3): O(n) scan with early-exit at `take` (trigrams can't prove substring)
 * - Query (needle length >= 3): O(c) after posting intersect, typically << n; early-exit at `take`
 */

export type SearchableProduct = {
  codeLower: string;
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

/** Legacy O(n) scan + early-exit — used for short needles and tests. */
export function searchProductsLinear<T extends SearchableProduct>(
  items: readonly T[],
  needle: string,
  take: number,
): T[] {
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
 * Substring search preserving catalog order, capped at `take`.
 * Needle is trimmed + lowercased (same as previous filterCatalog).
 */
export function searchProductIndex<T extends SearchableProduct>(
  index: ProductSearchIndex<T>,
  q: string,
  take = 30,
): T[] {
  const needle = q.trim().toLowerCase();
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
