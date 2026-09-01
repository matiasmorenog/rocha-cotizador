"use client";

import { useProductCatalog } from "@/hooks/use-product-catalog";

/** Prefetch quote catalog for logged-in customers (layout frame — all routes). */
export function CustomerCatalogWarmup() {
  useProductCatalog();
  return null;
}
