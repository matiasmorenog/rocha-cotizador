"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  indexCatalogProducts,
  type CatalogProduct,
  type ProductBase,
} from "@/lib/product-base";
import {
  clearCachedCatalog,
  readCachedCatalog,
  readCachedUnitPrices,
  subscribeCatalogStale,
  unitPriceFromMap,
  writeCachedCatalog,
  writeCachedUnitPrices,
} from "@/lib/client-catalog-cache";
import {
  buildProductSearchIndex,
  EMPTY_PRODUCT_SEARCH_INDEX,
  searchProductIndex,
  type ProductSearchIndex,
} from "@/lib/product-search";

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
  searchIndex: ProductSearchIndex<CatalogProduct>;
  version: string | null;
  unitPrices: Record<string, number>;
  ready: boolean;
  loading: boolean;
  error: string | null;
};

type CatalogSnapshot = {
  products: CatalogProduct[];
  searchIndex: ProductSearchIndex<CatalogProduct>;
  unitPrices: Record<string, number>;
  version: string | null;
  ready: boolean;
};

/** Background ping while tab stays visible — version only, then full catalog if stale. */
const CATALOG_VERSION_POLL_MS = 60 * 60 * 1000;

function customerKey(customerId?: string): string {
  return customerId?.trim() || "self";
}

function hydrateCatalog(products: ProductBase[]): {
  products: CatalogProduct[];
  searchIndex: ProductSearchIndex<CatalogProduct>;
} {
  const indexed = indexCatalogProducts(products);
  return {
    products: indexed,
    searchIndex: buildProductSearchIndex(indexed),
  };
}

function emptySearchIndex(): ProductSearchIndex<CatalogProduct> {
  return EMPTY_PRODUCT_SEARCH_INDEX as ProductSearchIndex<CatalogProduct>;
}

function mapSearchRows(
  searchIndex: ProductSearchIndex<CatalogProduct>,
  unitPrices: Record<string, number>,
  q: string,
  take: number,
): CatalogSearchProduct[] {
  const matched = searchProductIndex(searchIndex, q, take);
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

/** Sync filter from live catalog index (prefer this over `search()` for render). */
export function mapCatalogSearch(
  searchIndex: ProductSearchIndex<CatalogProduct>,
  unitPrices: Record<string, number>,
  q: string,
  take = 30,
): CatalogSearchProduct[] {
  return mapSearchRows(searchIndex, unitPrices, q, take);
}

function initialState(opts: UseProductCatalogOptions): CatalogState {
  const cached = typeof window !== "undefined" ? readCachedCatalog() : null;
  const key = customerKey(opts.customerId);
  const cachedPrices =
    typeof window !== "undefined" ? readCachedUnitPrices(key) : null;
  const products = cached?.products ?? [];
  const searchIndex =
    products.length > 0
      ? buildProductSearchIndex(products)
      : emptySearchIndex();

  return {
    products,
    searchIndex,
    version: cached?.version ?? null,
    unitPrices: cachedPrices?.unitPrices ?? {},
    ready: products.length > 0,
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

async function fetchCatalogVersion(customerId?: string) {
  const params = new URLSearchParams();
  if (customerId) params.set("customerId", customerId);
  const qs = params.toString();
  const res = await fetch(
    qs ? `/api/products/catalog/version?${qs}` : "/api/products/catalog/version",
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    version?: string;
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
  const snapshotRef = useRef<CatalogSnapshot>({
    products: state.products,
    searchIndex: state.searchIndex,
    unitPrices: state.unitPrices,
    version: state.version,
    ready: state.ready,
  });
  // Keep search()/searchAsync in sync with the latest paint (no post-effect lag).
  snapshotRef.current = {
    products: state.products,
    searchIndex: state.searchIndex,
    unitPrices: state.unitPrices,
    version: state.version,
    ready: state.ready,
  };
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  /** Sync snapshot before React re-renders so awaiters see fresh catalog. */
  function commitSnapshot(next: CatalogSnapshot) {
    snapshotRef.current = next;
  }

  useEffect(() => {
    let cancelled = false;
    const key = customerKey(opts.customerId);
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function revalidate() {
      const cached = readCachedCatalog();

      // SSR/hydration often keeps empty useState even when sessionStorage has a
      // catalog (initializer ran without window). Hydrate immediately so
      // ready/products are usable before the network round-trip finishes.
      if (
        cached &&
        cached.products.length > 0 &&
        snapshotRef.current.products.length === 0
      ) {
        const prices = readCachedUnitPrices(key);
        const { products, searchIndex } = hydrateCatalog(cached.products);
        if (!cancelled) {
          commitSnapshot({
            products,
            searchIndex,
            unitPrices: prices?.unitPrices ?? snapshotRef.current.unitPrices,
            version: cached.version,
            ready: true,
          });
          setState((s) => ({
            ...s,
            products,
            searchIndex,
            version: cached.version,
            unitPrices: prices?.unitPrices ?? s.unitPrices,
            ready: true,
            loading: true,
            error: null,
          }));
        }
      }

      const hasLocal =
        (cached?.products.length ?? 0) > 0 ||
        snapshotRef.current.products.length > 0;

      // Keep serving cached catalog while revalidating — do not block typing.
      setState((s) => ({
        ...s,
        loading: !hasLocal,
        error: null,
      }));

      const knownVersion =
        snapshotRef.current.version ??
        (cached && cached.products.length > 0 ? cached.version : null);

      const params = new URLSearchParams();
      if (knownVersion && hasLocal) {
        params.set("v", knownVersion);
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
          const { products, searchIndex } = hydrateCatalog(cached.products);
          commitSnapshot({
            products,
            searchIndex,
            unitPrices,
            version,
            ready: true,
          });
          setState({
            products,
            searchIndex,
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
          if (snapshotRef.current.products.length > 0) {
            setState((s) => ({
              ...s,
              loading: false,
              ready: true,
              error: null,
            }));
            return;
          }
          clearCachedCatalog();
          const emptyIndex = emptySearchIndex();
          commitSnapshot({
            products: [],
            searchIndex: emptyIndex,
            unitPrices: nextPrices,
            version: data.version ?? null,
            ready: false,
          });
          setState({
            products: [],
            searchIndex: emptyIndex,
            version: data.version ?? null,
            unitPrices: nextPrices,
            ready: false,
            loading: false,
            error: null,
          });
          return;
        }

        const version = data.version ?? knownVersion ?? cached?.version ?? "0";
        writeCachedCatalog({
          version,
          products,
          fetchedAt: Date.now(),
        });
        writeCachedUnitPrices(key, version, nextPrices);

        const hydrated = hydrateCatalog(products);
        commitSnapshot({
          products: hydrated.products,
          searchIndex: hydrated.searchIndex,
          unitPrices: nextPrices,
          version,
          ready: true,
        });
        setState({
          products: hydrated.products,
          searchIndex: hydrated.searchIndex,
          version,
          unitPrices: nextPrices,
          ready: true,
          loading: false,
          error: null,
        });
      } catch {
        if (cancelled) return;
        // Prefer session cache over an empty in-memory miss after network error.
        const fallback = readCachedCatalog();
        if (
          snapshotRef.current.products.length === 0 &&
          fallback &&
          fallback.products.length > 0
        ) {
          const prices = readCachedUnitPrices(key);
          const hydrated = hydrateCatalog(fallback.products);
          commitSnapshot({
            products: hydrated.products,
            searchIndex: hydrated.searchIndex,
            unitPrices: prices?.unitPrices ?? {},
            version: fallback.version,
            ready: true,
          });
          setState({
            products: hydrated.products,
            searchIndex: hydrated.searchIndex,
            version: fallback.version,
            unitPrices: prices?.unitPrices ?? {},
            ready: true,
            loading: false,
            error: null,
          });
          return;
        }
        setState((s) => ({
          ...s,
          loading: false,
          error: s.products.length > 0 ? null : "No se pudo cargar el catálogo",
          ready: s.products.length > 0,
        }));
      }
    }

    /** Coalesce concurrent kicks (visibility + focus, interval overlap). */
    function kick(task: () => Promise<void>) {
      if (cancelled) return;
      if (loadPromiseRef.current) return;
      const run = task().then(
        () => undefined,
        () => undefined,
      );
      loadPromiseRef.current = run;
      void run.finally(() => {
        if (loadPromiseRef.current === run) {
          loadPromiseRef.current = null;
        }
      });
    }

    async function pingVersionThenRefresh() {
      const cached = readCachedCatalog();
      const known =
        snapshotRef.current.version ??
        (cached && cached.products.length > 0 ? cached.version : null);
      if (!known) {
        await revalidate();
        return;
      }
      try {
        const { res, data } = await fetchCatalogVersion(opts.customerId);
        if (cancelled) return;
        if (!res.ok || !data.version) return;
        if (data.version !== known) {
          await revalidate();
        }
      } catch {
        // Keep serving local catalog.
      }
    }

    function kickRevalidate() {
      kick(revalidate);
    }

    function kickVersionCheck() {
      kick(pingVersionThenRefresh);
    }

    function stopInterval() {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function startInterval() {
      if (intervalId != null) return;
      intervalId = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        kickVersionCheck();
      }, CATALOG_VERSION_POLL_MS);
    }

    function onVisibilityChange() {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        kickVersionCheck();
        startInterval();
      } else {
        stopInterval();
      }
    }

    function onFocus() {
      kickVersionCheck();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        kickVersionCheck();
      }
    }

    kickRevalidate();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
      if (!document.hidden) startInterval();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      window.addEventListener("pageshow", onPageShow);
    }
    const unsubscribeStale = subscribeCatalogStale(() => {
      kickRevalidate();
    });

    return () => {
      cancelled = true;
      stopInterval();
      unsubscribeStale();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("pageshow", onPageShow);
      }
    };
  }, [opts.customerId]);

  const search = useCallback((q: string, take = 30): CatalogSearchProduct[] => {
    const snap = snapshotRef.current;
    return mapSearchRows(snap.searchIndex, snap.unitPrices, q, take);
  }, []);

  const searchAsync = useCallback(
    async (q: string, take = 30): Promise<CatalogSearchProduct[]> => {
      // Instant path: already have catalog in memory / sessionStorage.
      const snap = snapshotRef.current;
      if (snap.products.length > 0) {
        return mapSearchRows(snap.searchIndex, snap.unitPrices, q, take);
      }

      // Cold start: wait for first catalog load, then filter locally.
      if (loadPromiseRef.current) {
        await loadPromiseRef.current;
      }

      const after = snapshotRef.current;
      if (after.products.length > 0) {
        return mapSearchRows(after.searchIndex, after.unitPrices, q, take);
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
