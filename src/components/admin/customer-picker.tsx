"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { filterFoldedSearch } from "@/lib/search-fold";

export type PickedCustomer = {
  id: string;
  code: string;
  name: string;
  priceListName: string | null;
  active: boolean;
};

type CustomerPickerProps = {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
};

type SearchHit = {
  id: string;
  code: string;
  name: string;
  priceList?: { id: string; name: string } | null;
  active: boolean;
};

function activeHits(raw: SearchHit[] | undefined): SearchHit[] {
  return (raw ?? []).filter((c) => c.active);
}

function filterCustomers(catalog: SearchHit[], q: string, take = 30): SearchHit[] {
  return filterFoldedSearch(catalog, q, {
    primary: [(c) => c.code],
    secondary: [(c) => c.name],
    take,
  });
}

export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<SearchHit[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  /** Network fallback while preload empty, or local miss beyond first page. */
  const [coldResults, setColdResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [listDismissed, setListDismissed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const coldAbortRef = useRef<AbortController | null>(null);
  const coldRequestId = useRef(0);

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

  const listOpen =
    !listDismissed &&
    trimmedQuery.length > 0 &&
    (results.length > 0 ||
      (!searching && (catalogReady || coldResults !== null)));

  const activeHighlight =
    results.length === 0
      ? -1
      : Math.min(Math.max(highlightIndex, 0), results.length - 1);

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
    if (!listOpen || activeHighlight < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-customer-option="${activeHighlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeHighlight, listOpen, results]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setListDismissed(true);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pickCustomer(c: SearchHit) {
    onChange({
      id: c.id,
      code: c.code,
      name: c.name,
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {value.code} — {value.name}
          </p>
          <p className="text-xs text-neutral-500">
            Lista: {value.priceListName ?? "Precio base"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
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
      <div className="relative">
        <Input
          id="customer-search"
          role="combobox"
          aria-expanded={listOpen && results.length > 0}
          aria-controls="customer-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen && activeHighlight >= 0
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
      {listOpen && results.length > 0 ? (
        <ul
          ref={listRef}
          id="customer-search-listbox"
          role="listbox"
          className="absolute left-4 right-4 z-20 mt-1 max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          {results.map((c, index) => (
            <li key={c.id} role="presentation">
              <button
                type="button"
                id={`customer-option-${index}`}
                role="option"
                aria-selected={index === activeHighlight}
                data-customer-option={index}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                  index === activeHighlight
                    ? "bg-[var(--brand-primary-soft)]"
                    : "hover:bg-neutral-50",
                )}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => pickCustomer(c)}
              >
                <span className="font-medium text-neutral-900">
                  {c.code} — {c.name}
                </span>
                <span className="text-xs text-neutral-500">
                  Lista: {c.priceList?.name ?? "Precio base"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {listOpen &&
      !searching &&
      trimmedQuery.length > 0 &&
      results.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Sin clientes activos</p>
      ) : null}
    </div>
  );
}
