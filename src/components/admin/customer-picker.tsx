"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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

export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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
      setResults(
        (data.customers as SearchHit[] | undefined)?.filter((c) => c.active) ??
          [],
      );
      setOpen(true);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {value.code} — {value.name}
          </p>
          <p className="text-xs text-neutral-500">
            Lista: {value.priceListName ?? "Mayorista (base)"}
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
          id="customer-search"
          placeholder="Buscar por código o nombre…"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            if (next.trim().length < 1) {
              setResults([]);
              setOpen(false);
              setSearching(false);
            }
          }}
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
        <ul className="absolute left-4 right-4 z-20 mt-1 max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                onClick={() => {
                  onChange({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    priceListName: c.priceList?.name ?? null,
                    active: c.active,
                  });
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-neutral-900">
                  {c.code} — {c.name}
                </span>
                <span className="text-xs text-neutral-500">
                  Lista: {c.priceList?.name ?? "Mayorista (base)"}
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
