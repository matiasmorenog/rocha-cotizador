"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTableScroll } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ARGENTINA_TZ } from "@/lib/argentina-time";
import { quoteStatusLabel } from "@/lib/quote-status";
import { formatPrice } from "@/lib/utils";

export type QuoteListRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  customer: { code: string; name: string };
};

export function QuotesAdminPanel({
  initialQuotes,
  defaultFromLocal,
  defaultToLocal,
}: {
  initialQuotes: QuoteListRow[];
  defaultFromLocal: string;
  defaultToLocal: string;
}) {
  const [from, setFrom] = useState(defaultFromLocal);
  const [to, setTo] = useState(defaultToLocal);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return quotes;
    return quotes.filter(
      (q) =>
        q.number.toLowerCase().includes(needle) ||
        q.customer.code.toLowerCase().includes(needle) ||
        q.customer.name.toLowerCase().includes(needle),
    );
  }, [quotes, query]);

  function buildParams() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }

  async function onFilter(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes?${buildParams()}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        quotes?: QuoteListRow[];
      };
      if (!res.ok) {
        setError(data.error ?? "No se pudo filtrar");
        return;
      }
      setQuotes(data.quotes ?? []);
    } catch {
      setError("No se pudo filtrar");
    } finally {
      setLoading(false);
    }
  }

  function onDownload() {
    setDownloading(true);
    window.location.href = `/api/admin/quotes/export?${buildParams()}`;
    window.setTimeout(() => setDownloading(false), 2500);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <form onSubmit={onFilter} className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-900">
              Exportar cotizaciones
            </p>
            <p className="text-xs text-neutral-500">
              Por defecto: ayer 16:00 → hoy 16:00.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-600">
              Desde
              <Input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-600">
              Hasta
              <Input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full"
              />
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {loading ? (
                <>
                  <Spinner />
                  Filtrando…
                </>
              ) : (
                "Filtrar lista"
              )}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {downloading ? (
                <>
                  <Spinner className="text-white" />
                  Generando…
                </>
              ) : (
                "Descargar PDF"
              )}
            </button>
          </div>
        </form>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar número o cliente…"
        aria-label="Buscar cotizaciones"
      />

      <DataTableScroll>
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Número</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((qrow) => (
              <tr key={qrow.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">
                  <Link
                    href={`/remitos/${qrow.id}`}
                    className="font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    {qrow.number}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {qrow.customer.code} — {qrow.customer.name}
                </td>
                <td className="px-3 py-2">
                  {new Date(qrow.createdAt).toLocaleString("es-AR", {
                    timeZone: ARGENTINA_TZ,
                  })}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="success">
                    {quoteStatusLabel(qrow.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-medium">
                  {formatPrice(qrow.total)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  {query.trim()
                    ? "Sin cotizaciones para esa búsqueda"
                    : "Sin cotizaciones en este rango"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </DataTableScroll>
    </div>
  );
}
