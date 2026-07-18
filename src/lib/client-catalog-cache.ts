import type { ProductBase } from "@/lib/product-base";

const CATALOG_KEY = "rocha:product-catalog:v1";
const FACTOR_KEY = "rocha:price-factor:v1";

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

export function readCachedCatalog(): CachedCatalog | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (
      typeof parsed?.version !== "string" ||
      !Array.isArray(parsed.products)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedCatalog(catalog: CachedCatalog): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // Quota / private mode — memory-only still works via React state.
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
