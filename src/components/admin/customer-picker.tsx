"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type PickedCustomer = {
  id: string;
  code: string;
  name: string;
  discountPercent: number;
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
  discountPercent: number | string;
  active: boolean;
};

export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/customers?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setResults(
        (data.customers as SearchHit[] | undefined)?.filter((c) => c.active) ?? [],
      );
      setOpen(true);
    }, 200);
    return () => clearTimeout(handle);
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
            Descuento {value.discountPercent}%
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
          }
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
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
                    discountPercent: Number(c.discountPercent),
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
                  Desc. {Number(c.discountPercent)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length > 0 && results.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Sin clientes activos</p>
      ) : null}
    </div>
  );
}
