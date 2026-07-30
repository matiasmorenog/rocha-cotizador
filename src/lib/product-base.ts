import { foldSearchText } from "@/lib/search-fold";

/** Base catalog row — never includes customer unitPrice / discount. */
export type ProductBase = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  /** Serialized Decimal — apply discount outside shared catalog cache. */
  basePrice: number;
  /** Product may be ordered by unit count (price 0 until weighed) or by kg; false = cantidad. */
  allowsUnitOrder: boolean;
};

/**
 * In-memory catalog row with search keys precomputed once on hydrate.
 * `codeLower` / `nameLower` are folded (case + accents; ñ kept) — display
 * fields `code` / `name` stay original.
 */
export type CatalogProduct = ProductBase & {
  codeLower: string;
  nameLower: string;
};

export function indexCatalogProducts(
  products: ProductBase[],
): CatalogProduct[] {
  return products.map((p) => ({
    ...p,
    codeLower: foldSearchText(String(p.code ?? "")),
    nameLower: foldSearchText(String(p.name ?? "")),
  }));
}
