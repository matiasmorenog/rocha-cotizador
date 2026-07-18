"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductBase } from "@/lib/product-base";
import {
  filterCatalog,
  priceFactorFromDiscount,
  readCachedCatalog,
  readCachedPriceFactor,
  unitPriceFromFactor,
  writeCachedCatalog,
  writeCachedPriceFactor,
} from "@/lib/client-catalog-cache";

export type CatalogSearchProduct = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  unitPrice: number;
};

type UseProductCatalogOptions = {
  /** Admin quote-for-customer. */
  customerId?: string;
  /** Admin UI already has discount — used until/alongside catalog factor. */
  discountPercent?: number | null;
};

type CatalogState = {
  products: ProductBase[];
  version: string | null;
  priceFactor: number;
  ready: boolean;
  loading: boolean;
  error: string | null;
};

function customerKey(customerId?: string): string {
  return customerId?.trim() || "self";
}

function initialState(opts: UseProductCatalogOptions): CatalogState {
  const cached = typeof window !== "undefined" ? readCachedCatalog() : null;
  const key = customerKey(opts.customerId);
  const cachedFactor =
    typeof window !== "undefined" ? readCachedPriceFactor(key) : null;
  const fromDiscount =
    opts.discountPercent != null
      ? priceFactorFromDiscount(Number(opts.discountPercent))
      : null;

  return {
    products: cached?.products ?? [],
    version: cached?.version ?? null,
    priceFactor: fromDiscount ?? cachedFactor ?? 1,
    ready: (cached?.products.length ?? 0) > 0,
    loading: true,
    error: null,
  };
}

export function useProductCatalog(
  opts: UseProductCatalogOptions = {},
): CatalogState & {
  search: (q: string, take?: number) => CatalogSearchProduct[];
} {
  const [state, setState] = useState<CatalogState>(() => initialState(opts));

  useEffect(() => {
    let cancelled = false;
    const key = customerKey(opts.customerId);

    async function revalidate() {
      setState((s) => ({ ...s, loading: true, error: null }));

      const cached = readCachedCatalog();
      const params = new URLSearchParams();
      if (cached?.version) params.set("v", cached.version);
      if (opts.customerId) params.set("customerId", opts.customerId);

      try {
        const res = await fetch(`/api/products/catalog?${params}`);
        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState((s) => ({
            ...s,
            loading: false,
            error: data.error ?? "No se pudo cargar el catálogo",
            ready: s.products.length > 0,
          }));
          return;
        }

        const data = (await res.json()) as {
          unchanged: boolean;
          version: string;
          priceFactor: number;
          products: ProductBase[];
        };

        const priceFactor =
          opts.discountPercent != null
            ? priceFactorFromDiscount(Number(opts.discountPercent))
            : data.priceFactor;

        writeCachedPriceFactor(key, priceFactor);

        if (data.unchanged && cached) {
          setState({
            products: cached.products,
            version: data.version,
            priceFactor,
            ready: true,
            loading: false,
            error: null,
          });
          return;
        }

        const products = data.products ?? [];
        writeCachedCatalog({
          version: data.version,
          products,
          fetchedAt: Date.now(),
        });

        setState({
          products,
          version: data.version,
          priceFactor,
          ready: true,
          loading: false,
          error: null,
        });
      } catch {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: s.products.length > 0 ? null : "No se pudo cargar el catálogo",
          ready: s.products.length > 0,
        }));
      }
    }

    void revalidate();
    return () => {
      cancelled = true;
    };
  }, [opts.customerId, opts.discountPercent]);

  const search = useCallback(
    (q: string, take = 30): CatalogSearchProduct[] => {
      return filterCatalog(state.products, q, take).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        rubro: p.rubro,
        unitPrice: unitPriceFromFactor(p.basePrice, state.priceFactor),
      }));
    },
    [state.products, state.priceFactor],
  );

  return { ...state, search };
}
