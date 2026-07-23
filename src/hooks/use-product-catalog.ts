"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductBase } from "@/lib/product-base";
import {
  clearCachedCatalog,
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

async function fetchCatalogJson(params: URLSearchParams) {
  const res = await fetch(`/api/products/catalog?${params}`);
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    unchanged?: boolean;
    version?: string;
    priceFactor?: number;
    products?: ProductBase[];
  };
  return { res, data };
}

export function useProductCatalog(
  opts: UseProductCatalogOptions = {},
): CatalogState & {
  search: (q: string, take?: number) => CatalogSearchProduct[];
  searchAsync: (q: string, take?: number) => Promise<CatalogSearchProduct[]>;
} {
  const [state, setState] = useState<CatalogState>(() => initialState(opts));

  useEffect(() => {
    let cancelled = false;
    const key = customerKey(opts.customerId);

    async function revalidate() {
      setState((s) => ({ ...s, loading: true, error: null }));

      const cached = readCachedCatalog();
      const params = new URLSearchParams();
      // Only send version when we actually have products locally.
      if (cached?.version && cached.products.length > 0) {
        params.set("v", cached.version);
      }
      if (opts.customerId) params.set("customerId", opts.customerId);

      try {
        let { res, data } = await fetchCatalogJson(params);
        if (cancelled) return;

        if (!res.ok) {
          setState((s) => ({
            ...s,
            loading: false,
            error: data.error ?? "No se pudo cargar el catálogo",
            ready: s.products.length > 0,
          }));
          return;
        }

        const priceFactor =
          opts.discountPercent != null
            ? priceFactorFromDiscount(Number(opts.discountPercent))
            : typeof data.priceFactor === "number"
              ? data.priceFactor
              : 1;

        writeCachedPriceFactor(key, priceFactor);

        // Unchanged with empty local cache is invalid — force full body.
        if (data.unchanged && cached && cached.products.length > 0) {
          setState({
            products: cached.products,
            version: data.version ?? cached.version,
            priceFactor,
            ready: true,
            loading: false,
            error: null,
          });
          return;
        }

        let products = data.products ?? [];

        // Empty body after a version hint: drop cache and refetch without v.
        if (products.length === 0 && params.has("v")) {
          clearCachedCatalog();
          const full = new URLSearchParams();
          if (opts.customerId) full.set("customerId", opts.customerId);
          ({ res, data } = await fetchCatalogJson(full));
          if (cancelled) return;
          if (!res.ok) {
            setState((s) => ({
              ...s,
              loading: false,
              error: data.error ?? "No se pudo cargar el catálogo",
              ready: s.products.length > 0,
            }));
            return;
          }
          products = data.products ?? [];
        }

        if (products.length === 0) {
          clearCachedCatalog();
          setState({
            products: [],
            version: data.version ?? null,
            priceFactor,
            ready: false,
            loading: false,
            error: null,
          });
          return;
        }

        const version = data.version ?? cached?.version ?? "0";
        writeCachedCatalog({
          version,
          products,
          fetchedAt: Date.now(),
        });

        setState({
          products,
          version,
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

  /** Prefer local catalog; if empty, hit search API so UX never stuck blank. */
  const searchAsync = useCallback(
    async (q: string, take = 30): Promise<CatalogSearchProduct[]> => {
      const local = search(q, take);
      if (local.length > 0 || state.products.length > 0) return local;

      const params = new URLSearchParams({ q });
      if (opts.customerId) params.set("customerId", opts.customerId);
      try {
        const res = await fetch(`/api/products/search?${params}`);
        if (!res.ok) return [];
        const data = (await res.json()) as { products?: CatalogSearchProduct[] };
        return (data.products ?? []).slice(0, take);
      } catch {
        return [];
      }
    },
    [search, state.products.length, opts.customerId],
  );

  return { ...state, search, searchAsync };
}
