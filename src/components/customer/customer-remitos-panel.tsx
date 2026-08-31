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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ARGENTINA_TZ, defaultFilterDateRange } from "@/lib/argentina-time";
import type { CustomerRemitoRow } from "@/lib/customer-remitos-data";
import {
  clampCustomerRemitosHasta,
  CUSTOMER_REMITOS_MAX_RANGE_DAYS,
  customerRemitosDateRangeError,
} from "@/lib/customer-remitos-limits";
import { formatDeliveryDateLabel } from "@/lib/delivery-date";
import { quoteStatusLabel } from "@/lib/quote-status";
import { formatPrice } from "@/lib/utils";

type FetchMode = "range" | "search";

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
  defaultFrom,
  defaultTo,
}: {
  initialRemitos: CustomerRemitoRow[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom);
  const [appliedTo, setAppliedTo] = useState(defaultTo);
  const [remitos, setRemitos] = useState(initialRemitos);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FetchMode>("range");
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

  function onRangeChange(nextFrom: string, nextTo: string) {
    if (nextFrom.trim() && nextTo.trim()) {
      setFrom(nextFrom);
      setTo(clampCustomerRemitosHasta(nextFrom, nextTo));
      return;
    }
    setFrom(nextFrom);
    setTo(nextTo);
  }

  async function onFilter(e: FormEvent) {
    e.preventDefault();
    const fromValue = from.trim();
    const toValue = to.trim();
    if (!fromValue || !toValue) {
      setError("Indicá un período para filtrar por rango");
      return;
    }
    const rangeError = customerRemitosDateRangeError(fromValue, toValue);
    if (rangeError) {
      setError(rangeError);
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
    const { from: resetFrom, to: resetTo } = defaultFilterDateRange();
    setFrom(resetFrom);
    setTo(resetTo);
    setAppliedFrom(resetFrom);
    setAppliedTo(resetTo);
    setQuery("");
    setError(null);
    void fetchRemitos(buildParams({ from: resetFrom, to: resetTo }), "range");
  }

  function onQueryChange(value: string) {
    const hadSearch = query.trim().length > 0;
    setQuery(value);
    if (!value.trim() && hadSearch) {
      void fetchRemitos(
        buildParams({ from: appliedFrom, to: appliedTo }),
        "range",
      );
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
      : "Sin remitos en este rango";

  const showRangeChanged =
    mode !== "search" &&
    (from !== appliedFrom || to !== appliedTo);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <form onSubmit={onFilter} className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-900">
              Buscar en tu historial
            </p>
            <p className="text-xs text-neutral-500">
              Filtrá por fechas (máximo {CUSTOMER_REMITOS_MAX_RANGE_DAYS} días)
              o buscá por número de remito.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[14rem] shrink-0 flex-col gap-1 text-xs text-neutral-600">
              Período
              <DateRangePicker
                from={from}
                to={to}
                onChange={onRangeChange}
                aria-label="Período"
              />
            </label>
            <Button
              type="submit"
              variant="outline"
              disabled={loading}
              className="gap-2"
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
            {showRangeChanged || mode === "search" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={onReset}
              >
                Restablecer
              </Button>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
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
