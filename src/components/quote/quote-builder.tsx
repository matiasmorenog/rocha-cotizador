"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DataTableScroll } from "@/components/ui/data-table";
import { formatPrice } from "@/lib/utils";
import { useQuoteDraftStore } from "@/stores/quote-draft-store";
import {
  useProductCatalog,
  type CatalogSearchProduct,
} from "@/hooks/use-product-catalog";

type QuoteBuilderProps = {
  /** When set (admin flow), prices and submit use this customer. */
  customerId?: string;
  /** Optional discount label for admin UI only. */
  discountPercent?: number | null;
};

export function QuoteBuilder({ customerId, discountPercent }: QuoteBuilderProps = {}) {
  const router = useRouter();
  const lines = useQuoteDraftStore((s) => s.lines);
  const addOrUpdate = useQuoteDraftStore((s) => s.addOrUpdate);
  const setQty = useQuoteDraftStore((s) => s.setQty);
  const remove = useQuoteDraftStore((s) => s.remove);
  const clear = useQuoteDraftStore((s) => s.clear);
  const draftTotal = useQuoteDraftStore((s) => s.total());

  const catalog = useProductCatalog({ customerId, discountPercent });
  const { searchAsync } = catalog;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchProduct[]>([]);
  const [selected, setSelected] = useState<CatalogSearchProduct | null>(null);
  const [qty, setLocalQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const catalogLoading = catalog.loading && !catalog.ready;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      return;
    }
    let cancelled = false;
    // Local filter first; searchAsync falls back to API if catalog empty.
    const handle = setTimeout(() => {
      void searchAsync(q).then((rows) => {
        if (cancelled) return;
        setResults(rows);
        setOpen(true);
      });
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, searchAsync]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onQueryChange(value: string) {
    setSelected(null);
    setQuery(value);
    if (value.trim().length < 1) {
      setResults([]);
      setOpen(false);
    }
  }

  function addLine() {
    if (!selected) return;
    const n = Number(qty.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Cantidad inválida");
      return;
    }
    addOrUpdate({
      productId: selected.id,
      code: selected.code,
      name: selected.name,
      unitPrice: selected.unitPrice,
      qty: n,
    });
    setSelected(null);
    setQuery("");
    setLocalQty("1");
    setResults([]);
    setError(null);
  }

  async function submitQuote() {
    if (lines.length === 0) {
      setError("Agregá al menos un producto");
      return;
    }
    setSubmitting(true);
    setError(null);
    const trimmedNotes = notes.trim();
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        ...(customerId ? { customerId } : {}),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la cotización");
      return;
    }
    const data = await res.json();
    clear();
    setNotes("");
    // Prefer remito + ?whatsapp=1 so a blocked popup still leaves a clear CTA.
    if (typeof data.whatsappUrl === "string" && data.whatsappUrl) {
      window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      router.push(`/remitos/${data.id}?whatsapp=1`);
      return;
    }
    router.push(`/remitos/${data.id}`);
  }

  return (
    <div className="space-y-6">
      {discountPercent != null && discountPercent > 0 ? (
        <p className="text-sm text-neutral-600">
          Precios con descuento del cliente: {discountPercent}%
        </p>
      ) : null}

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <div className="relative" ref={boxRef}>
            <Label htmlFor="product-search">Producto</Label>
            <div className="relative">
              <Input
                id="product-search"
                placeholder={
                  catalog.ready
                    ? "Buscar por nombre o código…"
                    : catalog.loading
                      ? "Cargando catálogo…"
                      : "Buscar por nombre o código…"
                }
                value={selected ? `${selected.code} — ${selected.name}` : query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                autoComplete="off"
                disabled={catalogLoading}
                className={catalogLoading && !selected ? "pr-10" : undefined}
              />
              {catalogLoading && !selected ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner label="Cargando catálogo" />
                </span>
              ) : null}
            </div>
            {open && results.length > 0 ? (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      onClick={() => {
                        setSelected(p);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium text-neutral-900">
                        {p.code} — {p.name}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {p.rubro ? `${p.rubro} · ` : ""}
                        {formatPrice(p.unitPrice)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {open && query.trim().length > 0 && results.length === 0 && !catalogLoading ? (
              <p className="mt-2 text-sm text-neutral-500">Sin productos</p>
            ) : null}
            {catalog.error && !catalog.ready ? (
              <p className="mt-2 text-sm text-red-600">{catalog.error}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="qty">Cantidad</Label>
            <Input
              id="qty"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setLocalQty(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={addLine} disabled={!selected}>
              Agregar
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <DataTableScroll className="rounded-none border-0">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Cant.</th>
                <th className="px-3 py-2 font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Importe</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    Sin productos. Buscá y agregá líneas.
                  </td>
                </tr>
              ) : (
                lines.map((l) => (
                  <tr key={l.productId} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-mono text-xs">{l.code}</td>
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-24"
                        type="number"
                        min={0.001}
                        step="any"
                        value={l.qty}
                        onChange={(e) => setQty(l.productId, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2">{formatPrice(l.unitPrice)}</td>
                    <td className="px-3 py-2 font-medium">
                      {formatPrice(l.unitPrice * l.qty)}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="px-2 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
                        onClick={() => remove(l.productId)}
                        aria-label="Quitar"
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableScroll>
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm text-neutral-600">{lines.length} ítem(s)</p>
          <p className="text-lg font-semibold text-neutral-900">
            Total {formatPrice(draftTotal)}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="quote-notes">Observaciones</Label>
        <textarea
          id="quote-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional — aclaraciones del pedido (horario, detalle, etc.)"
          className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clear();
            setNotes("");
          }}
          disabled={!lines.length && !notes.trim()}
        >
          Vaciar
        </Button>
        <Button type="button" onClick={submitQuote} disabled={submitting || !lines.length}>
          {submitting ? (
            <>
              <Spinner className="mr-2 text-white" />
              Enviando…
            </>
          ) : (
            "Confirmar cotización"
          )}
        </Button>
      </div>
    </div>
  );
}
