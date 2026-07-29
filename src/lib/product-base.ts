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

/** In-memory catalog row with lowers precomputed once on hydrate (filter hot path). */
export type CatalogProduct = ProductBase & {
  codeLower: string;
  nameLower: string;
};

export function indexCatalogProducts(
  products: ProductBase[],
): CatalogProduct[] {
  return products.map((p) => ({
    ...p,
    codeLower: String(p.code ?? "").toLowerCase(),
    nameLower: String(p.name ?? "").toLowerCase(),
  }));
}
