"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAnchoredFloatingStyle } from "@/hooks/use-anchored-floating-style";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import { useIsClient } from "@/hooks/use-is-client";

export type PickedProduct = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
};

type AdminProductPickerProps = {
  value: PickedProduct | null;
  onChange: (product: PickedProduct | null) => void;
  /** Disable when editing an existing stock membership (product is fixed). */
  disabled?: boolean;
  /** Limit search hits to this Product.rubro (Tipo). */
  rubroFilter?: string | null;
  label?: string;
  id?: string;
};

/**
 * Code/name product search for admin stock catalog — same combobox pattern as
 * quote ProductPicker, without price list resolution (uses `/api/products/search`).
 */
export function AdminProductPicker({
  value,
  onChange,
  disabled = false,
  rubroFilter = null,
  label = "Producto",
  id = "admin-product-search",
}: AdminProductPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [listDismissed, setListDismissed] = useState(false);
  const isClient = useIsClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const listOpen =
    !disabled &&
    !value &&
    !listDismissed &&
    trimmed.length > 0 &&
    (results.length > 0 || searching);
  const showList = listOpen && results.length > 0;
  const showSearching = listOpen && searching && results.length === 0;
  const showEmpty =
    listOpen && !searching && results.length === 0 && trimmed.length > 0;
  const floatingOpen = showList || showSearching || showEmpty;
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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function clearSearchState() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    abortRef.current?.abort();
    requestId.current += 1;
    setResults([]);
    setSearching(false);
    setHighlightIndex(-1);
  }

  function scheduleSearch(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const idNow = ++requestId.current;
    setSearching(true);
    setHighlightIndex(0);

    debounceRef.current = setTimeout(() => {
      const ac = new AbortController();
      abortRef.current = ac;
      void fetch(
        `/api/products/search?q=${encodeURIComponent(q)}${
          rubroFilter
            ? `&rubro=${encodeURIComponent(rubroFilter)}`
            : ""
        }`,
        {
          signal: ac.signal,
        },
      )
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (idNow !== requestId.current) return;
          if (!res.ok) {
            setResults([]);
            setSearching(false);
            return;
          }
          const products = (data.products ?? []) as Array<{
            id: string;
            code: string;
            name: string;
            rubro: string | null;
          }>;
          setResults(
            products.map((p) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              rubro: p.rubro,
            })),
          );
          setSearching(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (idNow !== requestId.current) return;
          setResults([]);
          setSearching(false);
        });
    }, 180);
  }

  function pickProduct(p: PickedProduct) {
    onChange(p);
    setQuery("");
    clearSearchState();
    setListDismissed(true);
  }

  function onQueryChange(next: string) {
    if (disabled) return;
    if (value) onChange(null);
    setListDismissed(false);
    setQuery(next);
    const q = next.trim();
    if (q.length < 1) {
      clearSearchState();
      return;
    }
    scheduleSearch(q);
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
    if (disabled || value) return;
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
      <Label htmlFor={id}>{label}</Label>
      <div className="relative" ref={anchorRef}>
        <Input
          id={id}
          role="combobox"
          aria-expanded={floatingOpen}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-busy={searching || undefined}
          aria-activedescendant={
            showList && activeHighlight >= 0
              ? `${id}-option-${activeHighlight}`
              : undefined
          }
          placeholder="Buscar por nombre o código…"
          value={value ? `${value.code} — ${value.name}` : query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          onFocus={() => {
            if (trimmed.length > 0) setListDismissed(false);
          }}
          autoComplete="off"
          disabled={disabled}
          className={cn(searching && !value && "pr-10")}
        />
        {searching && !value ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner label="Buscando productos" />
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
              {showList ? (
                <ul
                  ref={listRef}
                  id={`${id}-listbox`}
                  role="listbox"
                  className="max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
                  onMouseOver={onListMouseOver}
                  onClick={onListClick}
                >
                  {results.map((p, index) => (
                    <li key={p.id} role="presentation">
                      <button
                        type="button"
                        id={`${id}-option-${index}`}
                        role="option"
                        aria-selected={index === activeHighlight}
                        data-product-option={index}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                          index === activeHighlight
                            ? "bg-[var(--brand-primary-soft)]"
                            : "hover:bg-neutral-50",
                        )}
                      >
                        <span className="font-medium text-neutral-900">
                          {p.code} — {p.name}
                        </span>
                        {p.rubro ? (
                          <span className="text-xs text-neutral-500">
                            {p.rubro}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {showSearching ? (
                <p
                  id={`${id}-listbox`}
                  role="status"
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500 shadow-lg"
                >
                  Buscando…
                </p>
              ) : null}
              {showEmpty ? (
                <p className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500 shadow-lg">
                  Sin productos
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
