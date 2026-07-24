/** Base catalog row — never includes customer unitPrice / discount. */
export type ProductBase = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  /** Serialized Decimal — apply discount outside shared catalog cache. */
  basePrice: number;
  /** Product may be ordered by unit count (price 0 until weighed) or by kg. */
  allowsUnitOrder: boolean;
};
