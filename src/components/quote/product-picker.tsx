"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatPrice } from "@/lib/utils";
import { useAnchoredFloatingStyle } from "@/hooks/use-anchored-floating-style";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import { useIsClient } from "@/hooks/use-is-client";
import {
  mapCatalogSearch,
  useProductCatalog,
  type CatalogSearchProduct,
} from "@/hooks/use-product-catalog";
import {
  PICKER_REVEAL_INITIAL,
  PICKER_REVEAL_STEP,
  useIncrementalReveal,
} from "@/hooks/use-incremental-reveal";

export type { CatalogSearchProduct };

import type { StockModuleKey } from "@/lib/stock-product-kind-shared";

type ProductPickerProps = {
  /** Admin quote-for-customer — resolves list prices. */
  customerId?: string;
  /** Admin stock recount — searches module-scoped products (incl. non-quotable kinds). */
  adminStockModule?: StockModuleKey;
  value: CatalogSearchProduct | null;
  onChange: (product: CatalogSearchProduct | null) => void;
  /** Optional filter (e.g. stock module rubro split). */
  filterProduct?: (product: CatalogSearchProduct) => boolean;
  /** Focus the search field after adding a line, etc. */
  inputRef?: RefObject<HTMLInputElement | null>;
};

type ProductOptionProps = {
  product: CatalogSearchProduct;
  index: number;
  active: boolean;
};

/** Price formatted only for visible options (not during catalog filter). */
const ProductOption = memo(
  function ProductOption({ product, index, active }: ProductOptionProps) {
    return (
      <li role="presentation">
        <button
          type="button"
          id={`product-option-${index}`}
          role="option"
          aria-selected={active}
          data-product-option={index}
          data-product-id={product.id}
          className={cn(
            "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
            active ? "bg-[var(--brand-primary-soft)]" : "hover:bg-neutral-50",
          )}
        >
          <span className="font-medium text-neutral-900">
            {product.code} — {product.name}
          </span>
          <span className="text-xs text-neutral-500">
            {product.rubro ? `${product.rubro} · ` : ""}
            {formatPrice(product.unitPrice)}
            {product.allowsUnitOrder ? " · kg o unidades" : ""}
          </span>
        </button>
      </li>
    );
  },
  (prev, next) =>
    prev.index === next.index &&
    prev.active === next.active &&
    prev.product.id === next.product.id &&
    prev.product.code === next.product.code &&
    prev.product.name === next.product.name &&
    prev.product.rubro === next.product.rubro &&
    prev.product.unitPrice === next.product.unitPrice &&
    prev.product.allowsUnitOrder === next.product.allowsUnitOrder,
);

function ProductPickerInner({
  customerId,
  adminStockModule,
  value,
  onChange,
  filterProduct,
  inputRef,
}: ProductPickerProps) {
  const catalog = useProductCatalog({ customerId });
  const { searchAsync } = catalog;
  const searchAsyncRef = useRef(searchAsync);
  const isClient = useIsClient();
  const useAdminStockSearch = Boolean(adminStockModule);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [coldResults, setColdResults] = useState<CatalogSearchProduct[] | null>(
    null,
  );
  const [coldInFlight, setColdInFlight] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [listDismissed, setListDismissed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const searchRequestId = useRef(0);

  const inputElRef = inputRef ?? localInputRef;
  // Usable = in-memory products present (ready flag alone can lag parent gate).
  // Gate on isClient: useProductCatalog may read sessionStorage on the client
  // first paint while SSR had an empty catalog — that mismatch hydrates badly.
  const catalogUsable =
    useAdminStockSearch ||
    (isClient && (catalog.ready || catalog.products.length > 0));
  const catalogLoading =
    !useAdminStockSearch && catalog.loading && !catalogUsable;
  const trimmedQuery = query.trim();
  const deferredTrimmed = deferredQuery.trim();
  const filterPending =
    !value &&
    trimmedQuery.length > 0 &&
    catalog.products.length > 0 &&
    deferredQuery !== query;
  // Ignore cold-flight once warm catalog hydrates — warmResults filter query.
  const coldSearchBusy = coldInFlight && catalog.products.length === 0;
  const searchBusy = filterPending || coldSearchBusy;
  const showInputSpinner = (catalogLoading || searchBusy) && !value;

  const warmResults = useMemo(() => {
    if (
      useAdminStockSearch ||
      value ||
      deferredTrimmed.length < 1 ||
      catalog.products.length === 0
    ) {
      return [] as CatalogSearchProduct[];
    }
    // No take cap: filter full in-memory catalog; DOM windowed below.
    const rows = mapCatalogSearch(
      catalog.searchIndex,
      catalog.unitPrices,
      deferredTrimmed,
      Number.POSITIVE_INFINITY,
    );
    return filterProduct ? rows.filter(filterProduct) : rows;
  }, [
    useAdminStockSearch,
    value,
    deferredTrimmed,
    catalog.products.length,
    catalog.searchIndex,
    catalog.unitPrices,
    filterProduct,
  ]);

  const results = useMemo(() => {
    const base = useAdminStockSearch
      ? (coldResults ?? [])
      : catalog.products.length > 0
        ? warmResults
        : (coldResults ?? []);
    return filterProduct ? base.filter(filterProduct) : base;
  }, [
    useAdminStockSearch,
    catalog.products.length,
    warmResults,
    coldResults,
    filterProduct,
  ]);

  const {
    visible: visibleResults,
    hasMore: hasMoreResults,
    ensureIndex,
    onScroll: onListScroll,
  } = useIncrementalReveal(results, {
    initial: PICKER_REVEAL_INITIAL,
    step: PICKER_REVEAL_STEP,
    resetKey: deferredTrimmed,
  });

  const listOpen =
    !value &&
    !listDismissed &&
    trimmedQuery.length > 0 &&
    (results.length > 0 ||
      searchBusy ||
      useAdminStockSearch ||
      (!catalogLoading && catalog.products.length > 0) ||
      coldResults !== null);

  const showList = listOpen && results.length > 0;
  const showSearching = listOpen && searchBusy && results.length === 0;
  const showEmpty =
    listOpen &&
    deferredTrimmed.length > 0 &&
    results.length === 0 &&
    !catalogLoading &&
    !searchBusy;
  const showError = Boolean(!useAdminStockSearch && catalog.error && !catalogUsable);
  const floatingOpen = showList || showSearching || showEmpty || showError;
  const {
    present: floatPresent,
    exiting: floatExiting,
    animKey: floatAnimKey,
  } = useExitPresence(floatingOpen, QUOTE_PICKER_FLOAT_MS);
  const floatingStyle = useAnchoredFloatingStyle(anchorRef, floatPresent);

  const activeHighlight =
    results.length === 0
      ? -1
      : Math.min(Math.max(highlightIndex, 0), results.length - 1);

  // Freeze portal payload while exit plays (open flags already false).
  const liveFloatView = useMemo(
    () => ({
      showList,
      showSearching,
      showEmpty,
      showError,
      filterPending,
      visibleResults,
      hasMoreResults,
      activeHighlight,
      results,
      error: catalog.error as string | null,
    }),
    [
      showList,
      showSearching,
      showEmpty,
      showError,
      filterPending,
      visibleResults,
      hasMoreResults,
      activeHighlight,
      results,
      catalog.error,
    ],
  );
  const [frozenFloatView, setFrozenFloatView] = useState(liveFloatView);
  if (floatingOpen && frozenFloatView !== liveFloatView) {
    setFrozenFloatView(liveFloatView);
  }
  const floatView = floatingOpen ? liveFloatView : frozenFloatView;

  useEffect(() => {
    searchAsyncRef.current = searchAsync;
  }, [searchAsync]);

  // Grow DOM window for keyboard nav, then scroll highlight into view.
  useEffect(() => {
    if (!showList || activeHighlight < 0) return;
    ensureIndex(activeHighlight);
  }, [activeHighlight, showList, ensureIndex]);

  useEffect(() => {
    if (!showList || activeHighlight < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-product-option="${activeHighlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeHighlight, showList, visibleResults.length]);

  useEffect(() => {
    function onDocDown(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || floatingRef.current?.contains(t)) {
        return;
      }
      setListDismissed(true);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const pickProduct = useCallback(
    (p: CatalogSearchProduct) => {
      onChange(p);
      setQuery("");
      setColdResults(null);
      setColdInFlight(false);
      setHighlightIndex(-1);
      setListDismissed(true);
    },
    [onChange],
  );

  function onQueryChange(next: string) {
    if (value) onChange(null);
    setListDismissed(false);
    setQuery(next);
    const q = next.trim();
    if (q.length < 1) {
      searchRequestId.current += 1;
      setColdResults(null);
      setColdInFlight(false);
      setHighlightIndex(-1);
      return;
    }

    setHighlightIndex(0);

    if (!useAdminStockSearch && catalog.products.length > 0) {
      setColdResults(null);
      setColdInFlight(false);
      return;
    }

    const requestId = ++searchRequestId.current;
    setColdInFlight(true);
    const searchPromise = useAdminStockSearch
      ? fetch(
          `/api/admin/stock/products?module=${adminStockModule}&q=${encodeURIComponent(q)}&take=50`,
        )
          .then(async (res) => {
            if (!res.ok) return [] as CatalogSearchProduct[];
            const data = (await res.json()) as {
              products?: CatalogSearchProduct[];
            };
            return data.products ?? [];
          })
          .catch(() => [] as CatalogSearchProduct[])
      : searchAsyncRef.current(q);
    void searchPromise.then((rows) => {
      if (requestId !== searchRequestId.current) return;
      const filtered = filterProduct ? rows.filter(filterProduct) : rows;
      setColdResults(filtered);
      setColdInFlight(false);
      setHighlightIndex(filtered.length > 0 ? 0 : -1);
    });
  }

  function onListMouseOver(e: MouseEvent<HTMLUListElement>) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-product-option]",
    );
    if (!btn || !listRef.current?.contains(btn)) return;
    const index = Number(btn.dataset.productOption);
    if (!Number.isFinite(index)) return;
    setHighlightIndex((cur) => (cur === index ? cur : index));
  }

  function onListClick(e: MouseEvent<HTMLUListElement>) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-product-option]",
    );
    if (!btn || !listRef.current?.contains(btn)) return;
    const index = Number(btn.dataset.productOption);
    const pick = results[index];
    if (pick) pickProduct(pick);
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (value) return;

    if (e.key === "Escape") {
      if (listOpen) {
        e.preventDefault();
        setListDismissed(true);
        setHighlightIndex(-1);
      }
      return;
    }

    if (!listOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => {
        const cur = i < 0 ? 0 : i;
        return (cur + 1) % results.length;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => {
        const cur = i < 0 ? 0 : i;
        return (cur - 1 + results.length) % results.length;
      });
      return;
    }
    if (e.key === "Enter") {
      const pick =
        activeHighlight >= 0 && activeHighlight < results.length
          ? results[activeHighlight]
          : results[0];
      if (pick) {
        e.preventDefault();
        pickProduct(pick);
      }
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <Label htmlFor="product-search">Producto</Label>
      <div className="relative" ref={anchorRef}>
        <Input
          ref={inputElRef}
          id="product-search"
          role="combobox"
          aria-expanded={floatingOpen}
          aria-controls="product-search-listbox"
          aria-autocomplete="list"
          aria-busy={searchBusy || catalogLoading || undefined}
          aria-activedescendant={
            showList && activeHighlight >= 0
              ? `product-option-${activeHighlight}`
              : undefined
          }
          placeholder={
            catalogUsable
              ? "Buscar por nombre o código…"
              : catalog.loading
                ? "Cargando catálogo…"
                : "Buscar por nombre o código…"
          }
          value={value ? `${value.code} — ${value.name}` : query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          onFocus={() => {
            if (trimmedQuery.length > 0) setListDismissed(false);
          }}
          autoComplete="off"
          className={cn(
            showInputSpinner && "pr-10",
            catalogLoading && "cursor-wait",
          )}
        />
        {showInputSpinner ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner
              label={
                catalogLoading
                  ? "Cargando catálogo"
                  : coldSearchBusy
                    ? "Buscando productos"
                    : "Filtrando productos"
              }
            />
          </span>
        ) : null}
      </div>
      {isClient && floatPresent && floatingStyle
        ? createPortal(
            <div
              key={floatAnimKey}
              ref={floatingRef}
              style={floatingStyle}
              className={cn(
                floatExiting
                  ? "quote-picker-float-exit pointer-events-none"
                  : "quote-picker-float-enter",
              )}
              aria-hidden={floatExiting || undefined}
            >
              {floatView.showList ? (
                <ul
                  ref={listRef}
                  id="product-search-listbox"
                  role="listbox"
                  className="max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
                  onMouseOver={onListMouseOver}
                  onClick={onListClick}
                  onScroll={onListScroll}
                >
                  {floatView.filterPending ? (
                    <li
                      role="presentation"
                      className="border-b border-neutral-100 px-3 py-1.5 text-xs text-neutral-500"
                    >
                      Buscando…
                    </li>
                  ) : null}
                  {floatView.visibleResults.map((p, index) => (
                    <ProductOption
                      key={p.id}
                      product={p}
                      index={index}
                      active={index === floatView.activeHighlight}
                    />
                  ))}
                  {floatView.hasMoreResults ? (
                    <li
                      role="presentation"
                      className="px-3 py-1.5 text-center text-xs text-neutral-400"
                    >
                      Desplazá para ver más…
                    </li>
                  ) : null}
                </ul>
              ) : null}
              {floatView.showSearching ? (
                <p
                  id="product-search-listbox"
                  role="status"
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500 shadow-lg"
                >
                  Buscando…
                </p>
              ) : null}
              {floatView.showEmpty ? (
                <p className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500 shadow-lg">
                  Sin productos
                </p>
              ) : null}
              {floatView.showError ? (
                <p className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 shadow-lg">
                  {floatView.error}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Isolated so keystrokes don't re-render the quote draft table. */
export const ProductPicker = memo(ProductPickerInner);
