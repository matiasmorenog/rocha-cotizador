"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

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
  /** Focus search on mount (e.g. after “Confirmar y crear nuevo remito”). */
  autoFocusSearch?: boolean;
};

type SearchHit = {
  id: string;
  code: string;
  name: string;
  priceList?: { id: string; name: string } | null;
  active: boolean;
};

export function CustomerPicker({
  value,
  onChange,
  autoFocusSearch = false,
}: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocusSearch || value) return;
    queueMicrotask(() => searchInputRef.current?.focus());
  }, [autoFocusSearch, value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(
        `/api/admin/customers?q=${encodeURIComponent(q)}`,
      );
      if (cancelled) return;
      setSearching(false);
      if (!res.ok) return;
      const data = await res.json();
      const hits =
        (data.customers as SearchHit[] | undefined)?.filter((c) => c.active) ??
        [];
      setResults(hits);
      setHighlightIndex(hits.length > 0 ? 0 : -1);
      setOpen(true);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    if (!open || highlightIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-customer-option="${highlightIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open, results]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
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
    setResults([]);
    setHighlightIndex(-1);
    setOpen(false);
  }

  function onQueryChange(next: string) {
    setQuery(next);
    setHighlightIndex(-1);
    if (next.trim().length < 1) {
      setResults([]);
      setOpen(false);
      setSearching(false);
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setHighlightIndex(-1);
      }
      return;
    }

    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < 0 ? 0 : (i + 1) % results.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) =>
        i < 0 ? results.length - 1 : (i - 1 + results.length) % results.length,
      );
      return;
    }
    if (e.key === "Enter") {
      const pick =
        highlightIndex >= 0 && highlightIndex < results.length
          ? results[highlightIndex]
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
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
          Cambiar cliente
        </Button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-neutral-200 bg-white p-4" ref={boxRef}>
      <Label htmlFor="customer-search">Cliente</Label>
      <div className="relative">
        <Input
          ref={searchInputRef}
          id="customer-search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="customer-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            open && highlightIndex >= 0
              ? `customer-option-${highlightIndex}`
              : undefined
          }
          placeholder="Buscar por código o nombre…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
          className={searching ? "pr-10" : undefined}
        />
        {searching ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner label="Buscando clientes" />
          </span>
        ) : null}
      </div>
      {open && results.length > 0 ? (
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
                aria-selected={index === highlightIndex}
                data-customer-option={index}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                  index === highlightIndex
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
      {open && !searching && query.trim().length > 0 && results.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Sin clientes activos</p>
      ) : null}
    </div>
  );
}
