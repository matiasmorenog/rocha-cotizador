"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatPrice } from "@/lib/utils";
import {
  mapCatalogSearch,
  useProductCatalog,
  type CatalogSearchProduct,
} from "@/hooks/use-product-catalog";

export type { CatalogSearchProduct };

type ProductPickerProps = {
  /** Admin quote-for-customer — resolves list prices. */
  customerId?: string;
  value: CatalogSearchProduct | null;
  onChange: (product: CatalogSearchProduct | null) => void;
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
  value,
  onChange,
  inputRef,
}: ProductPickerProps) {
  const catalog = useProductCatalog({ customerId });
  const { searchAsync } = catalog;
  const searchAsyncRef = useRef(searchAsync);

  const [query, setQuery] = useState("");
  const [coldResults, setColdResults] = useState<CatalogSearchProduct[] | null>(
    null,
  );
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [listDismissed, setListDismissed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const searchRequestId = useRef(0);

  const inputElRef = inputRef ?? localInputRef;
  const catalogLoading = catalog.loading && !catalog.ready;
  const trimmedQuery = query.trim();

  const warmResults = useMemo(() => {
    if (value || trimmedQuery.length < 1 || catalog.products.length === 0) {
      return [] as CatalogSearchProduct[];
    }
    return mapCatalogSearch(
      catalog.products,
      catalog.unitPrices,
      trimmedQuery,
    );
  }, [value, trimmedQuery, catalog.products, catalog.unitPrices]);

  const results = useMemo(
    () => (catalog.products.length > 0 ? warmResults : (coldResults ?? [])),
    [catalog.products.length, warmResults, coldResults],
  );

  const listOpen =
    !value &&
    !listDismissed &&
    trimmedQuery.length > 0 &&
    (results.length > 0 ||
      (!catalogLoading && catalog.products.length > 0) ||
      coldResults !== null);

  const activeHighlight =
    results.length === 0
      ? -1
      : Math.min(Math.max(highlightIndex, 0), results.length - 1);

  useEffect(() => {
    searchAsyncRef.current = searchAsync;
  }, [searchAsync]);

  // Only scroll when highlight moves — not on every new results array identity.
  useEffect(() => {
    if (!listOpen || activeHighlight < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-product-option="${activeHighlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeHighlight, listOpen]);

  useEffect(() => {
    function onDocDown(e: globalThis.MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setListDismissed(true);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const pickProduct = useCallback(
    (p: CatalogSearchProduct) => {
      onChange(p);
      setQuery("");
      setColdResults(null);
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
      setHighlightIndex(-1);
      return;
    }

    setHighlightIndex(0);

    if (catalog.products.length > 0) {
      setColdResults(null);
      return;
    }

    const requestId = ++searchRequestId.current;
    void searchAsyncRef.current(q).then((rows) => {
      if (requestId !== searchRequestId.current) return;
      setColdResults(rows);
      setHighlightIndex(rows.length > 0 ? 0 : -1);
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
      <div className="relative">
        <Input
          ref={inputElRef}
          id="product-search"
          role="combobox"
          aria-expanded={listOpen && results.length > 0}
          aria-controls="product-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen && activeHighlight >= 0
              ? `product-option-${activeHighlight}`
              : undefined
          }
          placeholder={
            catalog.ready
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
          disabled={catalogLoading}
          className={catalogLoading && !value ? "pr-10" : undefined}
        />
        {catalogLoading && !value ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner label="Cargando catálogo" />
          </span>
        ) : null}
      </div>
      {listOpen && results.length > 0 ? (
        <ul
          ref={listRef}
          id="product-search-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
          onMouseOver={onListMouseOver}
          onClick={onListClick}
        >
          {results.map((p, index) => (
            <ProductOption
              key={p.id}
              product={p}
              index={index}
              active={index === activeHighlight}
            />
          ))}
        </ul>
      ) : null}
      {listOpen &&
      trimmedQuery.length > 0 &&
      results.length === 0 &&
      !catalogLoading ? (
        <p className="absolute z-50 mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500 shadow-lg">
          Sin productos
        </p>
      ) : null}
      {catalog.error && !catalog.ready ? (
        <p className="absolute z-50 mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 shadow-lg">
          {catalog.error}
        </p>
      ) : null}
    </div>
  );
}

/** Isolated so keystrokes don't re-render the quote draft table. */
export const ProductPicker = memo(ProductPickerInner);
