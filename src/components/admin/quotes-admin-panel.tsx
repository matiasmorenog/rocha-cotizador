"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableScroll } from "@/components/ui/data-table";
import { DatetimeLocalPicker } from "@/components/ui/datetime-local-picker";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import { useSmoothListHeight } from "@/hooks/use-smooth-list-height";
import { useSmoothColumnWidths } from "@/hooks/use-smooth-column-widths";
import {
  useSelectedRow,
  type RowSelectionProps,
} from "@/hooks/use-selected-row";
import {
  ARGENTINA_TZ,
  ORDER_CUTOFF_HOUR_AR,
  splitQuotesByDayCutoff,
} from "@/lib/argentina-time";
import { formatDeliveryDateLabel } from "@/lib/delivery-date";
import { quoteStatusLabel } from "@/lib/quote-status";
import { cn, formatPrice } from "@/lib/utils";
import { filterFoldedSearch } from "@/lib/search-fold";

export type QuoteListRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  /** `YYYY-MM-DD` when set; null = legacy quote before deliveryDate. */
  deliveryDate: string | null;
  customer: { code: string; name: string };
};

function afterCutoffSummary(count: number): string {
  const hora = `${ORDER_CUTOFF_HOUR_AR}:00`;
  if (count === 1) {
    return `1 cotización ingresada después del cierre (${hora})`;
  }
  return `${count} cotizaciones ingresadas después del cierre (${hora})`;
}

/** Late rows: padding in inner pad so 0fr↔1fr cell shells can ease table height. */
function LateCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("quote-draft-row-td", className)}>
      <div className="quote-draft-row-cell-shell">
        <div className="quote-draft-row-cell-clip">
          <div className="quote-draft-row-cell-pad">{children}</div>
        </div>
      </div>
    </td>
  );
}

function QuoteDataRow({
  qrow,
  muted,
  className,
  rowProps,
}: {
  qrow: QuoteListRow;
  muted?: boolean;
  className?: string;
  rowProps?: RowSelectionProps;
}) {
  const numberCell = (
    <Link
      href={`/remitos/${qrow.id}`}
      className="font-medium text-[var(--brand-primary)] hover:underline"
    >
      {qrow.number}
    </Link>
  );
  const customerCell = (
    <span className="admin-table-name-2l max-w-[16rem]">
      {qrow.customer.code} — {qrow.customer.name}
    </span>
  );
  const createdCell = new Date(qrow.createdAt).toLocaleString("es-AR", {
    timeZone: ARGENTINA_TZ,
  });
  const deliveryCell = formatDeliveryDateLabel(qrow.deliveryDate);
  const statusCell = (
    <Badge variant="success">{quoteStatusLabel(qrow.status)}</Badge>
  );
  const totalCell = formatPrice(qrow.total);

  return (
    <tr
      {...rowProps}
      tabIndex={0}
      className={cn(
        "admin-table-row border-t border-neutral-200",
        muted && "bg-amber-50/40",
        className,
      )}
    >
      {muted ? (
        <>
          <LateCell>{numberCell}</LateCell>
          <LateCell>{customerCell}</LateCell>
          <LateCell>{createdCell}</LateCell>
          <LateCell className="text-neutral-700">{deliveryCell}</LateCell>
          <LateCell>{statusCell}</LateCell>
          <LateCell className="font-medium">{totalCell}</LateCell>
        </>
      ) : (
        <>
          <td className="px-3 py-2">{numberCell}</td>
          <td className="px-3 py-2">{customerCell}</td>
          <td className="px-3 py-2">{createdCell}</td>
          <td className="px-3 py-2 text-neutral-700">{deliveryCell}</td>
          <td className="px-3 py-2">{statusCell}</td>
          <td className="px-3 py-2 font-medium">{totalCell}</td>
        </>
      )}
    </tr>
  );
}

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
  const [lateOpen, setLateOpen] = useState(false);
  const {
    present: latePresent,
    exiting: lateExiting,
    animKey: lateAnimKey,
  } = useExitPresence(lateOpen, QUOTE_PICKER_FLOAT_MS);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = searchInputRef.current;
    if (!el) return;

    function isIdleFocus(node: Element | null) {
      return (
        !node ||
        node === document.body ||
        node === document.documentElement ||
        node === el
      );
    }

    // Mount-only: focus search unless user already moved focus elsewhere.
    if (!isIdleFocus(document.activeElement)) return;

    queueMicrotask(() => {
      if (!isIdleFocus(document.activeElement)) return;
      el.focus({ preventScroll: true });
    });
  }, []);

  const filtered = useMemo(
    () =>
      filterFoldedSearch(quotes, query, {
        primary: [(q) => q.number, (q) => q.customer.code],
        secondary: [(q) => q.customer.name],
        emptyReturnsAll: true,
      }),
    [quotes, query],
  );

  const { main, afterCutoff } = useMemo(
    () => splitQuotesByDayCutoff(filtered, to),
    [filtered, to],
  );

  // Freeze late rows while exit plays (filter can clear afterCutoff same tick).
  const [frozenLate, setFrozenLate] = useState(afterCutoff);
  if (lateOpen && frozenLate !== afterCutoff) {
    setFrozenLate(afterCutoff);
  }
  const lateRows = lateOpen ? afterCutoff : frozenLate;

  const tableHeightLockRef = useRef<HTMLDivElement>(null);
  useSmoothListHeight(tableHeightLockRef, filtered.length);

  const tableRef = useRef<HTMLTableElement>(null);
  useSmoothColumnWidths(tableRef, `${query}|${filtered.length}`);
  const rowIds = useMemo(
    () => [
      ...(latePresent ? lateRows.map((r) => r.id) : []),
      ...main.map((r) => r.id),
    ],
    [latePresent, lateRows, main],
  );
  const { rowProps } = useSelectedRow(rowIds);

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
      setLateOpen(false);
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

  const emptyLabel = query.trim()
    ? "Sin cotizaciones para esa búsqueda"
    : "Sin cotizaciones en este rango";
  const showEmpty = main.length === 0 && afterCutoff.length === 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <form onSubmit={onFilter} className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-900">
              Filtrar cotizaciones
            </p>
            <p className="text-xs text-neutral-500">
              Por defecto: ayer {ORDER_CUTOFF_HOUR_AR}:00 → ahora (hora
              Argentina). Las ingresadas después del cierre van arriba, en una
              fila expansible (orden más reciente primero).
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex w-[12.75rem] shrink-0 flex-col gap-1 text-xs text-neutral-600">
              Desde
              <DatetimeLocalPicker
                value={from}
                onChange={setFrom}
                aria-label="Desde"
              />
            </label>
            <label className="flex w-[12.75rem] shrink-0 flex-col gap-1 text-xs text-neutral-600">
              Hasta
              <DatetimeLocalPicker
                value={to}
                onChange={setTo}
                aria-label="Hasta"
              />
            </label>

            {error ? (
              <p className="w-full text-sm text-red-600 sm:order-last">{error}</p>
            ) : null}

            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
              <Button
                type="submit"
                variant="outline"
                disabled={loading}
                className="w-full gap-2 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Filtrando…
                  </>
                ) : (
                  "Filtrar lista"
                )}
              </Button>
              <Button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="w-full gap-2 sm:w-auto"
              >
                {downloading ? (
                  <>
                    <Spinner className="text-white" />
                    Generando…
                  </>
                ) : (
                  "Descargar PDF"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <Input
        ref={searchInputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar número o cliente…"
        aria-label="Buscar cotizaciones"
      />

      <div ref={tableHeightLockRef}>
        <DataTableScroll>
          <table ref={tableRef} className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Entrega</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {afterCutoff.length > 0 ? (
                <tr className="border-t border-neutral-200 bg-amber-50/50">
                  <td colSpan={6} className="px-3 py-0">
                    <button
                      type="button"
                      onClick={() => setLateOpen((o) => !o)}
                      aria-expanded={lateOpen}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm font-medium text-amber-950 hover:bg-amber-50/80"
                    >
                      <span>
                        {afterCutoffSummary(afterCutoff.length)}
                        <span className="mt-0.5 block text-xs font-normal text-amber-800/80">
                          Próximo ciclo de preparación —{" "}
                          {lateOpen ? "ocultar" : "mostrar"}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-amber-900/70 transition-transform duration-200 motion-reduce:transition-none",
                          lateOpen && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                  </td>
                </tr>
              ) : null}

              {latePresent
                ? lateRows.map((qrow) => (
                    <QuoteDataRow
                      key={`${lateAnimKey}-${qrow.id}`}
                      qrow={qrow}
                      muted
                      rowProps={rowProps(qrow.id)}
                      className={cn(
                        lateExiting
                          ? "admin-late-row-exit pointer-events-none"
                          : "admin-late-row-enter",
                      )}
                    />
                  ))
                : null}

              {afterCutoff.length > 0 && main.length > 0 ? (
                <tr aria-hidden className="pointer-events-none">
                  <td colSpan={6} className="border-0 p-0">
                    <div className="h-0.5 w-full bg-amber-300" />
                  </td>
                </tr>
              ) : null}

              {main.map((qrow) => (
                <QuoteDataRow
                  key={qrow.id}
                  qrow={qrow}
                  rowProps={rowProps(qrow.id)}
                />
              ))}

              {showEmpty ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-neutral-500"
                  >
                    {emptyLabel}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </DataTableScroll>
      </div>
    </div>
  );
}
