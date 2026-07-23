import type { ProductBase } from "@/lib/product-base";

/** Bump key when cache shape/semantics change — clears poisoned empty catalogs. */
const CATALOG_KEY = "rocha:product-catalog:v2";
const FACTOR_KEY = "rocha:price-factor:v2";
const MAX_AGE_MS = 1000 * 60 * 60; // 1h — force full refetch even if version matches

export type { ProductBase };
export type CachedCatalog = {
  version: string;
  products: ProductBase[];
  fetchedAt: number;
};

type CachedPriceFactor = {
  customerKey: string;
  priceFactor: number;
  fetchedAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

/** One-shot drop of legacy empty-poison keys. */
function purgeLegacyCatalogKeys(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem("rocha:product-catalog:v1");
    sessionStorage.removeItem("rocha:price-factor:v1");
  } catch {
    // ignore
  }
}

export function readCachedCatalog(): CachedCatalog | null {
  if (!canUseStorage()) return null;
  purgeLegacyCatalogKeys();
  try {
    const raw = sessionStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (
      typeof parsed?.version !== "string" ||
      !Array.isArray(parsed.products) ||
      parsed.products.length === 0 ||
      typeof parsed.fetchedAt !== "number"
    ) {
      sessionStorage.removeItem(CATALOG_KEY);
      return null;
    }
    if (Date.now() - parsed.fetchedAt > MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(CATALOG_KEY);
    return null;
  }
}

export function writeCachedCatalog(catalog: CachedCatalog): void {
  if (!canUseStorage()) return;
  // Never persist an empty catalog — it poisons version checks (`unchanged`).
  if (!catalog.products.length) {
    clearCachedCatalog();
    return;
  }
  try {
    sessionStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // Quota / private mode — memory-only still works via React state.
  }
}

export function clearCachedCatalog(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(CATALOG_KEY);
    // Drop legacy keys from earlier cache versions (may hold empty poison).
    sessionStorage.removeItem("rocha:product-catalog:v1");
    sessionStorage.removeItem("rocha:price-factor:v1");
  } catch {
    // ignore
  }
}

export function readCachedPriceFactor(customerKey: string): number | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(FACTOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPriceFactor;
    if (parsed.customerKey !== customerKey) return null;
    if (typeof parsed.priceFactor !== "number") return null;
    return parsed.priceFactor;
  } catch {
    return null;
  }
}

export function writeCachedPriceFactor(
  customerKey: string,
  priceFactor: number,
): void {
  if (!canUseStorage()) return;
  try {
    const payload: CachedPriceFactor = {
      customerKey,
      priceFactor,
      fetchedAt: Date.now(),
    };
    sessionStorage.setItem(FACTOR_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/** Local catalog search (same rules as server searchActiveProductsBase). */
export function filterCatalog(
  products: ProductBase[],
  q: string,
  take = 30,
): ProductBase[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  const matched: ProductBase[] = [];
  for (const p of products) {
    if (
      p.code.toLowerCase().includes(needle) ||
      p.name.toLowerCase().includes(needle)
    ) {
      matched.push(p);
      if (matched.length >= take) break;
    }
  }
  return matched;
}

/** Display unit price from base + factor (1 - discount/100). */
export function unitPriceFromFactor(
  basePrice: number,
  priceFactor: number,
): number {
  return Math.round(basePrice * priceFactor * 100) / 100;
}

export function priceFactorFromDiscount(discountPercent: number): number {
  return 1 - discountPercent / 100;
}
