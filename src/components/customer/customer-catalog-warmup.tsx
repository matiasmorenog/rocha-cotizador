"use client";

import { useProductCatalog } from "@/hooks/use-product-catalog";

/** Prefetch quote catalog on customer home so /cotizar search is warm. */
export function CustomerCatalogWarmup() {
  useProductCatalog();
  return null;
}
