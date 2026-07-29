import {
  indexCatalogProducts,
  type CatalogProduct,
  type ProductBase,
} from "@/lib/product-base";
import {
  searchProductIndex,
  type ProductSearchIndex,
} from "@/lib/product-search";

/** Bump key when cache shape/semantics change — clears poisoned empty catalogs. */
const CATALOG_KEY = "rocha:product-catalog:v4";
const UNIT_PRICES_KEY = "rocha:unit-prices:v4";
const MAX_AGE_MS = 1000 * 60 * 60; // 1h

export type { CatalogProduct, ProductBase };
export type CachedCatalog = {
  version: string;
  products: ProductBase[];
  fetchedAt: number;
};

/** Session-storage shape is ProductBase[]; memory always holds indexed lowers. */
export type IndexedCachedCatalog = {
  version: string;
  products: CatalogProduct[];
  fetchedAt: number;
};

function stripSearchIndex(products: Array<ProductBase | CatalogProduct>): ProductBase[] {
  return products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    rubro: p.rubro,
    basePrice: p.basePrice,
    allowsUnitOrder: p.allowsUnitOrder,
  }));
}

type CachedUnitPrices = {
  customerKey: string;
  version: string;
  unitPrices: Record<string, number>;
  fetchedAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function purgeLegacyCatalogKeys(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem("rocha:product-catalog:v1");
    sessionStorage.removeItem("rocha:product-catalog:v2");
    sessionStorage.removeItem("rocha:product-catalog:v3");
    sessionStorage.removeItem("rocha:unit-prices:v3");
    sessionStorage.removeItem("rocha:price-factor:v1");
    sessionStorage.removeItem("rocha:price-factor:v2");
  } catch {
    // ignore
  }
}

export function readCachedCatalog(): IndexedCachedCatalog | null {
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
    return {
      version: parsed.version,
      fetchedAt: parsed.fetchedAt,
      products: indexCatalogProducts(parsed.products),
    };
  } catch {
    sessionStorage.removeItem(CATALOG_KEY);
    return null;
  }
}

export function writeCachedCatalog(catalog: CachedCatalog): void {
  if (!canUseStorage()) return;
  if (!catalog.products.length) {
    clearCachedCatalog();
    return;
  }
  try {
    const payload: CachedCatalog = {
      version: catalog.version,
      fetchedAt: catalog.fetchedAt,
      products: stripSearchIndex(catalog.products),
    };
    sessionStorage.setItem(CATALOG_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode
  }
}

export function clearCachedCatalog(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(CATALOG_KEY);
    sessionStorage.removeItem(UNIT_PRICES_KEY);
    purgeLegacyCatalogKeys();
  } catch {
    // ignore
  }
}

export function readCachedUnitPrices(
  customerKey: string,
): CachedUnitPrices | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(UNIT_PRICES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUnitPrices;
    if (parsed.customerKey !== customerKey) return null;
    if (!parsed.unitPrices || typeof parsed.unitPrices !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedUnitPrices(
  customerKey: string,
  version: string,
  unitPrices: Record<string, number>,
): void {
  if (!canUseStorage()) return;
  try {
    const payload: CachedUnitPrices = {
      customerKey,
      version,
      unitPrices,
      fetchedAt: Date.now(),
    };
    sessionStorage.setItem(UNIT_PRICES_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/**
 * Filter catalog by substring on code/name.
 * Prefer `searchIndex` (trigrams) when available; otherwise linear early-exit.
 */
export function filterCatalog(
  products: Array<ProductBase | CatalogProduct>,
  q: string,
  take = 30,
  searchIndex?: ProductSearchIndex<CatalogProduct> | null,
): ProductBase[] {
  if (searchIndex && searchIndex.items.length > 0) {
    return searchProductIndex(searchIndex, q, take);
  }

  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  const matched: ProductBase[] = [];
  for (const p of products) {
    const code =
      "codeLower" in p && typeof p.codeLower === "string"
        ? p.codeLower
        : String(p.code ?? "").toLowerCase();
    const name =
      "nameLower" in p && typeof p.nameLower === "string"
        ? p.nameLower
        : String(p.name ?? "").toLowerCase();
    if (code.includes(needle) || name.includes(needle)) {
      matched.push(p);
      if (matched.length >= take) break;
    }
  }
  return matched;
}

export function unitPriceFromMap(
  code: string,
  basePrice: number,
  unitPrices: Record<string, number>,
): number {
  const fromList = unitPrices[code];
  if (typeof fromList === "number" && Number.isFinite(fromList)) return fromList;
  return basePrice;
}
