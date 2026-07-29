"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  indexCatalogProducts,
  type CatalogProduct,
  type ProductBase,
} from "@/lib/product-base";
import {
  clearCachedCatalog,
  filterCatalog,
  readCachedCatalog,
  readCachedUnitPrices,
  unitPriceFromMap,
  writeCachedCatalog,
  writeCachedUnitPrices,
} from "@/lib/client-catalog-cache";

export type CatalogSearchProduct = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  unitPrice: number;
  allowsUnitOrder: boolean;
};

type UseProductCatalogOptions = {
  /** Admin quote-for-customer. */
  customerId?: string;
};

type CatalogState = {
  products: CatalogProduct[];
  version: string | null;
  unitPrices: Record<string, number>;
  ready: boolean;
  loading: boolean;
  error: string | null;
};

type CatalogSnapshot = {
  products: CatalogProduct[];
  unitPrices: Record<string, number>;
  ready: boolean;
};

function customerKey(customerId?: string): string {
  return customerId?.trim() || "self";
}

function mapSearchRows(
  products: CatalogProduct[],
  unitPrices: Record<string, number>,
  q: string,
  take: number,
): CatalogSearchProduct[] {
  // Filter first; only hydrate unitPrice/DTO for the visible take.
  const matched = filterCatalog(products, q, take);
  const out: CatalogSearchProduct[] = new Array(matched.length);
  for (let i = 0; i < matched.length; i++) {
    const p = matched[i]!;
    out[i] = {
      id: p.id,
      code: p.code,
      name: p.name,
      rubro: p.rubro,
      unitPrice: unitPriceFromMap(p.code, p.basePrice, unitPrices),
      allowsUnitOrder: Boolean(p.allowsUnitOrder),
    };
  }
  return out;
}

/** Sync filter from live catalog arrays (prefer this over `search()` for render). */
export function mapCatalogSearch(
  products: CatalogProduct[],
  unitPrices: Record<string, number>,
  q: string,
  take = 30,
): CatalogSearchProduct[] {
  return mapSearchRows(products, unitPrices, q, take);
}

function initialState(opts: UseProductCatalogOptions): CatalogState {
  const cached = typeof window !== "undefined" ? readCachedCatalog() : null;
  const key = customerKey(opts.customerId);
  const cachedPrices =
    typeof window !== "undefined" ? readCachedUnitPrices(key) : null;

  return {
    products: cached?.products ?? [],
    version: cached?.version ?? null,
    unitPrices: cachedPrices?.unitPrices ?? {},
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
    unitPrices?: Record<string, number>;
    products?: ProductBase[];
  };
  return { res, data };
}

function hydrateProducts(products: ProductBase[]): CatalogProduct[] {
  return indexCatalogProducts(products);
}

export function useProductCatalog(
  opts: UseProductCatalogOptions = {},
): CatalogState & {
  search: (q: string, take?: number) => CatalogSearchProduct[];
  searchAsync: (q: string, take?: number) => Promise<CatalogSearchProduct[]>;
} {
  const [state, setState] = useState<CatalogState>(() => initialState(opts));
  const snapshotRef = useRef<CatalogSnapshot>({
    products: state.products,
    unitPrices: state.unitPrices,
    ready: state.ready,
  });
  // Keep search()/searchAsync in sync with the latest paint (no post-effect lag).
  snapshotRef.current = {
    products: state.products,
    unitPrices: state.unitPrices,
    ready: state.ready,
  };
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = customerKey(opts.customerId);

    async function revalidate() {
      const cached = readCachedCatalog();
      const hasLocal =
        (cached?.products.length ?? 0) > 0 ||
        snapshotRef.current.products.length > 0;

      // Keep serving cached catalog while revalidating — do not block typing.
      setState((s) => ({
        ...s,
        loading: !hasLocal,
        error: null,
      }));

      const params = new URLSearchParams();
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

        const unitPrices =
          data.unitPrices && typeof data.unitPrices === "object"
            ? data.unitPrices
            : {};

        if (data.unchanged && cached && cached.products.length > 0) {
          const version = data.version ?? cached.version;
          writeCachedUnitPrices(key, version, unitPrices);
          setState({
            products: cached.products,
            version,
            unitPrices,
            ready: true,
            loading: false,
            error: null,
          });
          return;
        }

        // Server said unchanged but we have no products — force full fetch.
        if (data.unchanged && params.has("v")) {
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
        }

        let products = data.products ?? [];

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

        const nextPrices =
          data.unitPrices && typeof data.unitPrices === "object"
            ? data.unitPrices
            : unitPrices;

        if (products.length === 0) {
          // Do not wipe a good in-memory catalog on a bad empty response.
          setState((s) => {
            if (s.products.length > 0) {
              return { ...s, loading: false, ready: true, error: null };
            }
            clearCachedCatalog();
            return {
              products: [],
              version: data.version ?? null,
              unitPrices: nextPrices,
              ready: false,
              loading: false,
              error: null,
            };
          });
          return;
        }

        const version = data.version ?? cached?.version ?? "0";
        writeCachedCatalog({
          version,
          products,
          fetchedAt: Date.now(),
        });
        writeCachedUnitPrices(key, version, nextPrices);

        setState({
          products: hydrateProducts(products),
          version,
          unitPrices: nextPrices,
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

    const run = revalidate();
    loadPromiseRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [opts.customerId]);

  const search = useCallback((q: string, take = 30): CatalogSearchProduct[] => {
    const snap = snapshotRef.current;
    return mapSearchRows(snap.products, snap.unitPrices, q, take);
  }, []);

  const searchAsync = useCallback(
    async (q: string, take = 30): Promise<CatalogSearchProduct[]> => {
      // Instant path: already have catalog in memory / sessionStorage.
      const snap = snapshotRef.current;
      if (snap.products.length > 0) {
        return mapSearchRows(snap.products, snap.unitPrices, q, take);
      }

      // Cold start: wait for first catalog load, then filter locally.
      if (loadPromiseRef.current) {
        await loadPromiseRef.current;
      }

      const after = snapshotRef.current;
      if (after.products.length > 0) {
        return mapSearchRows(after.products, after.unitPrices, q, take);
      }

      // Last resort only if catalog still empty after load.
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
    [opts.customerId],
  );

  return { ...state, search, searchAsync };
}
