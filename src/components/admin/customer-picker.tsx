"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { filterFoldedSearch } from "@/lib/search-fold";
import { AdminCustomerName } from "@/components/admin/admin-customer-name";
import { useAnchoredFloatingStyle } from "@/hooks/use-anchored-floating-style";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import { useIsClient } from "@/hooks/use-is-client";
import {
  PICKER_REVEAL_INITIAL,
  PICKER_REVEAL_STEP,
  useIncrementalReveal,
} from "@/hooks/use-incremental-reveal";

export type PickedCustomer = {
  id: string;
  code: string;
  name: string;
  nameNote: string | null;
  priceListName: string | null;
  active: boolean;
};

type CustomerPickerProps = {
  value: PickedCustomer | null;
  /** Admin “Cambiar cliente”: play chip exit before parent clears value. */
  exiting?: boolean;
  onChange: (customer: PickedCustomer | null) => void;
  /** Focus search when selector is shown (e.g. after “Confirmar y crear nuevo remito”). */
  autoFocusSearch?: boolean;
  /** Bump to re-run focus after each create-new cycle. */
  focusToken?: number;
};

type SearchHit = {
  id: string;
  code: string;
  name: string;
  nameNote?: string | null;
  priceList?: { id: string; name: string } | null;
  active: boolean;
};

function activeHits(raw: SearchHit[] | undefined): SearchHit[] {
  return (raw ?? []).filter((c) => c.active);
}

function filterCustomers(catalog: SearchHit[], q: string): SearchHit[] {
  // No take cap: filter full preload; DOM windowed in the listbox.
  return filterFoldedSearch(catalog, q, {
    primary: [(c) => c.code],
    secondary: [(c) => c.name, (c) => c.nameNote ?? ""],
  });
}

export function CustomerPicker({
  value,
  exiting = false,
  onChange,
  autoFocusSearch = false,
  focusToken = 0,
}: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<SearchHit[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  /** Network fallback while preload empty, or local miss beyond first page. */
  const [coldResults, setColdResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [listDismissed, setListDismissed] = useState(false);
  const isClient = useIsClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const coldAbortRef = useRef<AbortController | null>(null);
  const coldRequestId = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocusSearch || value) return;
    queueMicrotask(() => searchInputRef.current?.focus());
  }, [autoFocusSearch, value, focusToken]);

  // Prefetch for warm in-memory filter (same idea as product catalog).
  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/admin/customers", { signal: ac.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { customers?: SearchHit[] };
        setCatalog(activeHits(data.customers));
      } catch {
        // aborted or network — cold path still works
      } finally {
        if (!ac.signal.aborted) setCatalogReady(true);
      }
    })();
    return () => ac.abort();
  }, []);

  const trimmedQuery = query.trim();

  const warmResults = useMemo(() => {
    if (trimmedQuery.length < 1 || catalog.length === 0) {
      return [] as SearchHit[];
    }
    return filterCustomers(catalog, trimmedQuery);
  }, [catalog, trimmedQuery]);

  const results = useMemo(() => {
    if (warmResults.length > 0) return warmResults;
    if (coldResults !== null) return coldResults;
    return warmResults;
  }, [warmResults, coldResults]);

  const {
    visible: visibleResults,
    hasMore: hasMoreResults,
    ensureIndex,
    onScroll: onListScroll,
  } = useIncrementalReveal(results, {
    initial: PICKER_REVEAL_INITIAL,
    step: PICKER_REVEAL_STEP,
    resetKey: trimmedQuery,
  });

  const listOpen =
    !listDismissed &&
    trimmedQuery.length > 0 &&
    (results.length > 0 ||
      (!searching && (catalogReady || coldResults !== null)));

  const showList = listOpen && results.length > 0;
  const {
    present: floatPresent,
    exiting: floatExiting,
    animKey: floatAnimKey,
  } = useExitPresence(showList, QUOTE_PICKER_FLOAT_MS);
  const floatingStyle = useAnchoredFloatingStyle(anchorRef, floatPresent);

  const activeHighlight =
    results.length === 0
      ? -1
      : Math.min(Math.max(highlightIndex, 0), results.length - 1);

  // Freeze listbox payload while exit plays.
  const liveFloatView = useMemo(
    () => ({
      visibleResults,
      hasMoreResults,
      activeHighlight,
    }),
    [visibleResults, hasMoreResults, activeHighlight],
  );
  const [frozenFloatView, setFrozenFloatView] = useState(liveFloatView);
  if (showList && frozenFloatView !== liveFloatView) {
    setFrozenFloatView(liveFloatView);
  }
  const floatView = showList ? liveFloatView : frozenFloatView;

  // Local miss after warm catalog ready → server q (customers beyond preload page).
  useEffect(() => {
    if (!catalogReady || catalog.length === 0) return;
    if (trimmedQuery.length < 1) return;
    if (warmResults.length > 0) return;

    const ac = new AbortController();
    coldAbortRef.current?.abort();
    coldAbortRef.current = ac;
    const requestId = ++coldRequestId.current;

    void (async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/customers?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: ac.signal },
        );
        if (!res.ok || requestId !== coldRequestId.current) return;
        const data = (await res.json()) as { customers?: SearchHit[] };
        setColdResults(activeHits(data.customers));
        setHighlightIndex(0);
      } catch {
        if (!ac.signal.aborted && requestId === coldRequestId.current) {
          setColdResults([]);
        }
      } finally {
        if (!ac.signal.aborted && requestId === coldRequestId.current) {
          setSearching(false);
        }
      }
    })();

    return () => ac.abort();
  }, [catalogReady, catalog.length, trimmedQuery, warmResults.length]);

  useEffect(() => {
    if (!showList || activeHighlight < 0) return;
    ensureIndex(activeHighlight);
  }, [activeHighlight, showList, ensureIndex]);

  useEffect(() => {
    if (!showList || activeHighlight < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-customer-option="${activeHighlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeHighlight, showList, visibleResults.length]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || floatingRef.current?.contains(t)) {
        return;
      }
      setListDismissed(true);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pickCustomer(c: SearchHit) {
    onChange({
      id: c.id,
      code: c.code,
      name: c.name,
      nameNote: c.nameNote ?? null,
      priceListName: c.priceList?.name ?? null,
      active: c.active,
    });
    setQuery("");
    setColdResults(null);
    setHighlightIndex(-1);
    setListDismissed(true);
  }

  function runColdSearch(q: string) {
    coldAbortRef.current?.abort();
    const ac = new AbortController();
    coldAbortRef.current = ac;
    const requestId = ++coldRequestId.current;
    setSearching(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/customers?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        if (!res.ok || requestId !== coldRequestId.current) return;
        const data = (await res.json()) as { customers?: SearchHit[] };
        const hits = activeHits(data.customers);
        setColdResults(hits);
        setHighlightIndex(hits.length > 0 ? 0 : -1);
      } catch {
        if (!ac.signal.aborted && requestId === coldRequestId.current) {
          setColdResults([]);
        }
      } finally {
        if (!ac.signal.aborted && requestId === coldRequestId.current) {
          setSearching(false);
        }
      }
    })();
  }

  function onQueryChange(next: string) {
    setListDismissed(false);
    setQuery(next);
    const q = next.trim();
    if (q.length < 1) {
      coldAbortRef.current?.abort();
      coldRequestId.current += 1;
      setColdResults(null);
      setHighlightIndex(-1);
      setSearching(false);
      return;
    }

    setHighlightIndex(0);

    // Warm: list derived in render. Clear stale cold; network only if preload empty.
    if (catalog.length > 0) {
      setColdResults(null);
      setSearching(false);
      return;
    }

    runColdSearch(q);
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
        pickCustomer(pick);
      }
    }
  }

  if (value) {
    return (
      <div
        className={cn(
          "quote-customer-selected flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4",
          exiting && "quote-customer-exit pointer-events-none",
        )}
        aria-hidden={exiting || undefined}
      >
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {value.code} —{" "}
            <AdminCustomerName name={value.name} nameNote={value.nameNote} />
          </p>
          <p className="text-xs text-neutral-500">
            Lista: {value.priceListName ?? "Precio base"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exiting}
          onClick={() => onChange(null)}
        >
          Cambiar cliente
        </Button>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-lg border border-neutral-200 bg-white p-4"
      ref={boxRef}
    >
      <Label htmlFor="customer-search">Cliente</Label>
      <div className="relative" ref={anchorRef}>
        <Input
          ref={searchInputRef}
          id="customer-search"
          role="combobox"
          aria-expanded={showList}
          aria-controls="customer-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeHighlight >= 0
              ? `customer-option-${activeHighlight}`
              : undefined
          }
          placeholder={
            catalogReady || catalog.length > 0
              ? "Buscar por código o nombre…"
              : "Cargando clientes…"
          }
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          onFocus={() => {
            if (trimmedQuery.length > 0) setListDismissed(false);
          }}
          autoComplete="off"
          className={searching ? "pr-10" : undefined}
        />
        {searching ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner label="Buscando clientes" />
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
              <ul
                ref={listRef}
                id="customer-search-listbox"
                role="listbox"
                className="max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
                onScroll={onListScroll}
              >
                {floatView.visibleResults.map((c, index) => (
                  <li key={c.id} role="presentation">
                    <button
                      type="button"
                      id={`customer-option-${index}`}
                      role="option"
                      aria-selected={index === floatView.activeHighlight}
                      data-customer-option={index}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                        index === floatView.activeHighlight
                          ? "bg-[var(--brand-primary-soft)]"
                          : "hover:bg-neutral-50",
                      )}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onClick={() => pickCustomer(c)}
                    >
                      <span className="font-medium text-neutral-900">
                        {c.code} —{" "}
                        <AdminCustomerName name={c.name} nameNote={c.nameNote} />
                      </span>
                      <span className="text-xs text-neutral-500">
                        Lista: {c.priceList?.name ?? "Precio base"}
                      </span>
                    </button>
                  </li>
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
            </div>,
            document.body,
          )
        : null}
      {listOpen &&
      !searching &&
      trimmedQuery.length > 0 &&
      results.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Sin clientes activos</p>
      ) : null}
    </div>
  );
}
