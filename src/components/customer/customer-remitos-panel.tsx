"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableScroll } from "@/components/ui/data-table";
import { DatetimeLocalPicker } from "@/components/ui/datetime-local-picker";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ARGENTINA_TZ } from "@/lib/argentina-time";
import type { CustomerRemitoRow } from "@/lib/customer-remitos-data";
import { formatDeliveryDateLabel } from "@/lib/delivery-date";
import { quoteStatusLabel } from "@/lib/quote-status";
import { formatPrice } from "@/lib/utils";

type FetchMode = "default" | "range" | "search";

function buildParams(opts: {
  from?: string;
  to?: string;
  q?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.q) params.set("q", opts.q);
  return params;
}

function RemitoRow({ row }: { row: CustomerRemitoRow }) {
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-3 py-2">
        <Link
          href={`/remitos/${row.number}`}
          className="font-medium text-[var(--brand-primary)] hover:underline"
        >
          {row.number}
        </Link>
      </td>
      <td className="px-3 py-2">
        {new Date(row.createdAt).toLocaleString("es-AR", {
          timeZone: ARGENTINA_TZ,
        })}
      </td>
      <td className="px-3 py-2 text-neutral-700">
        {formatDeliveryDateLabel(row.deliveryDate)}
      </td>
      <td className="px-3 py-2">
        <Badge variant="success">{quoteStatusLabel(row.status)}</Badge>
      </td>
      <td className="px-3 py-2 font-medium">{formatPrice(row.total)}</td>
    </tr>
  );
}

export function CustomerRemitosPanel({
  initialRemitos,
}: {
  initialRemitos: CustomerRemitoRow[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [remitos, setRemitos] = useState(initialRemitos);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FetchMode>("default");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRemitos = useCallback(
    async (params: URLSearchParams, nextMode: FetchMode) => {
      setLoading(true);
      setError(null);
      try {
        const qs = params.toString();
        const res = await fetch(
          qs ? `/api/customer/remitos?${qs}` : "/api/customer/remitos",
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          remitos?: CustomerRemitoRow[];
        };
        if (!res.ok) {
          setError(data.error ?? "No se pudo cargar");
          return;
        }
        setRemitos(data.remitos ?? []);
        setMode(nextMode);
      } catch {
        setError("No se pudo cargar");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  async function onFilter(e: FormEvent) {
    e.preventDefault();
    const fromValue = from.trim();
    const toValue = to.trim();
    if (!fromValue || !toValue) {
      setError("Indicá fecha Desde y Hasta para filtrar por rango");
      return;
    }
    setAppliedFrom(fromValue);
    setAppliedTo(toValue);
    const q = query.trim();
    await fetchRemitos(
      buildParams({ from: fromValue, to: toValue, q: q || undefined }),
      q ? "search" : "range",
    );
  }

  function onReset() {
    setFrom("");
    setTo("");
    setAppliedFrom("");
    setAppliedTo("");
    setQuery("");
    setError(null);
    setRemitos(initialRemitos);
    setMode("default");
  }

  function onQueryChange(value: string) {
    const hadSearch = query.trim().length > 0;
    setQuery(value);
    if (!value.trim() && hadSearch) {
      if (appliedFrom && appliedTo) {
        void fetchRemitos(
          buildParams({ from: appliedFrom, to: appliedTo }),
          "range",
        );
      } else {
        setRemitos(initialRemitos);
        setMode("default");
      }
    }
  }

  useEffect(() => {
    const q = query.trim();
    if (!q) return;

    searchDebounceRef.current = setTimeout(() => {
      void fetchRemitos(
        buildParams({
          from: appliedFrom || undefined,
          to: appliedTo || undefined,
          q,
        }),
        "search",
      );
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [query, appliedFrom, appliedTo, fetchRemitos]);

  const emptyLabel =
    mode === "search"
      ? "Sin remitos para esa búsqueda"
      : mode === "range"
        ? "Sin remitos en este rango"
        : "Todavía no hay remitos.";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <form onSubmit={onFilter} className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-900">
              Buscar en tu historial
            </p>
            <p className="text-xs text-neutral-500">
              Por defecto ves tus 5 remitos más recientes. Elegí un rango de
              fechas o buscá por número para ver más.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex w-full min-w-[12.75rem] shrink-0 flex-col gap-1 text-xs text-neutral-600 sm:w-[12.75rem]">
              Desde
              <DatetimeLocalPicker
                value={from}
                onChange={setFrom}
                aria-label="Desde"
              />
            </label>
            <label className="flex w-full min-w-[12.75rem] shrink-0 flex-col gap-1 text-xs text-neutral-600 sm:w-[12.75rem]">
              Hasta
              <DatetimeLocalPicker
                value={to}
                onChange={setTo}
                aria-label="Hasta"
              />
            </label>

            {error ? (
              <p className="w-full text-sm text-red-600">{error}</p>
            ) : null}

            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
              <Button
                type="submit"
                variant="outline"
                disabled={loading}
                className="w-full gap-2 sm:w-auto"
              >
                {loading && mode !== "search" ? (
                  <>
                    <Spinner />
                    Filtrando…
                  </>
                ) : (
                  "Filtrar"
                )}
              </Button>
              {mode !== "default" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={onReset}
                  className="w-full sm:w-auto"
                >
                  Ver últimos 5
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar por número (ej. R-000018)…"
        aria-label="Buscar remitos"
        className="bg-white"
      />

      <DataTableScroll>
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Número</th>
              <th className="px-3 py-2 font-medium">Pedido</th>
              <th className="px-3 py-2 font-medium">Entrega</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && mode === "search" ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-neutral-500"
                >
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Buscando…
                  </span>
                </td>
              </tr>
            ) : remitos.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              remitos.map((row) => <RemitoRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </DataTableScroll>
    </div>
  );
}
