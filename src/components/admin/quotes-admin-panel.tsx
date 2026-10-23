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
import { ChevronDown, ClipboardPlus, FileText } from "lucide-react";
import { CotizacionesTransitionLink } from "@/components/admin/cotizaciones-route-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableScroll } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  SolapasTabButton,
  SolapasTabList,
} from "@/components/ui/solapas-tabs";
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
import type { AdminProductSalesRow } from "@/lib/admin-quotes-by-product";
import {
  ARGENTINA_TZ,
  splitQuotesByDayCutoff,
} from "@/lib/argentina-time";
import { formatDeliveryDateLabel } from "@/lib/delivery-date";
import { formatOrderCutoffHourLabel, isOrderCutoffEnforced } from "@/lib/order-cutoff";
import { quoteStatusLabel } from "@/lib/quote-status";
import { cn, formatPrice, formatQty } from "@/lib/utils";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { filterFoldedSearch } from "@/lib/search-fold";

type CotizacionesView = "list" | "product";

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

function afterCutoffSummary(count: number, cutoffHour: number): string {
  const hora = formatOrderCutoffHourLabel(cutoffHour);
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
      href={`/remitos/${qrow.number}`}
      className="font-medium text-[var(--brand-primary)] hover:underline"
    >
      {qrow.number}
    </Link>
  );
  const customerCell = (
    <>
      {qrow.customer.code} — {qrow.customer.name}
    </>
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
  orderCutoffHourAr,
}: {
  initialQuotes: QuoteListRow[];
  defaultFromLocal: string;
  defaultToLocal: string;
  orderCutoffHourAr: number;
}) {
  const [from, setFrom] = useState(defaultFromLocal);
  const [to, setTo] = useState(defaultToLocal);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<CotizacionesView>("list");
  const [productRows, setProductRows] = useState<AdminProductSalesRow[]>([]);
  const [productQuoteCount, setProductQuoteCount] = useState(0);
  const [productQuery, setProductQuery] = useState("");
  const [productLoadedKey, setProductLoadedKey] = useState<string | null>(null);
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

  const { main, afterCutoff } = useMemo(() => {
    if (!isOrderCutoffEnforced()) {
      return { main: filtered, afterCutoff: [] as typeof filtered };
    }
    return splitQuotesByDayCutoff(filtered, to, orderCutoffHourAr);
  }, [filtered, to, orderCutoffHourAr]);

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
    const q = query.trim();
    if (q) params.set("q", q);
    const product = productQuery.trim();
    if (product) params.set("product", product);
    return params;
  }

  function productCacheKey() {
    return `${from}|${to}|${query.trim()}`;
  }

  async function loadQuotes() {
    const res = await fetch(`/api/admin/quotes?${buildParams()}`);
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      quotes?: QuoteListRow[];
    };
    if (!res.ok) {
      throw new Error(data.error ?? "No se pudo filtrar");
    }
    setQuotes(data.quotes ?? []);
    setLateOpen(false);
  }

  async function loadProducts() {
    const key = productCacheKey();
    const res = await fetch(`/api/admin/quotes/by-product?${buildParams()}`);
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      rows?: AdminProductSalesRow[];
      quoteCount?: number;
    };
    if (!res.ok) {
      throw new Error(data.error ?? "No se pudo cargar el resumen por producto");
    }
    setProductRows(data.rows ?? []);
    setProductQuoteCount(data.quoteCount ?? 0);
    setProductLoadedKey(key);
  }

  async function onFilter(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (view === "product") {
        await loadProducts();
      } else {
        await loadQuotes();
        setProductLoadedKey(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo filtrar",
      );
    } finally {
      setLoading(false);
    }
  }

  function selectView(next: CotizacionesView) {
    if (next === view) return;
    setView(next);
    setError(null);
  }

  // Por producto: same live client/number filter as Lista (debounced refetch).
  useEffect(() => {
    if (view !== "product") return;
    const key = productCacheKey();
    if (key === productLoadedKey) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void loadProducts()
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el resumen por producto",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // loadProducts closes over from/to/query; key encodes those.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [view, from, to, query, productLoadedKey]);

  function onDownload() {
    setError(null);
    // Open blank tab on the click gesture — never navigate this page (filters stay).
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setError(
        "El navegador bloqueó la pestaña del PDF. Permití ventanas emergentes para este sitio e intentá de nuevo.",
      );
      return;
    }
    try {
      tab.opener = null;
      tab.document.title = "Generando PDF…";
    } catch {
      // ignore — some browsers restrict about:blank document access
    }

    setDownloading(true);
    const params = buildParams();
    params.set("_ts", String(Date.now()));
    const url = `/api/admin/quotes/export?${params}`;

    void (async () => {
      let blobUrl: string | null = null;
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "No se pudo generar el PDF");
        }
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        tab.location.replace(blobUrl);
        window.setTimeout(() => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
        }, 120_000);
      } catch (err) {
        try {
          tab.close();
        } catch {
          // ignore
        }
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setError(
          err instanceof Error ? err.message : "No se pudo generar el PDF",
        );
      } finally {
        setDownloading(false);
      }
    })();
  }

  const filteredProducts = useMemo(
    () =>
      filterFoldedSearch(productRows, productQuery, {
        primary: [(row) => row.productCode],
        secondary: [(row) => row.productName],
        emptyReturnsAll: true,
      }),
    [productRows, productQuery],
  );

  /** Sum of visible product line amounts (not full remito totals). */
  const filteredProductSum = useMemo(
    () =>
      filteredProducts.reduce((acc, row) => {
        const n = row.amount;
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0),
    [filteredProducts],
  );

  const emptyLabel = query.trim()
    ? "Sin cotizaciones para esa búsqueda"
    : "Sin cotizaciones en este rango";
  const showEmpty = main.length === 0 && afterCutoff.length === 0;
  const productEmptyLabel = productQuery.trim()
    ? "Sin productos para esa búsqueda"
    : query.trim()
      ? "Sin productos en las cotizaciones de esa búsqueda"
      : "Sin productos en este rango";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <form onSubmit={onFilter} className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-900">
              Filtrar cotizaciones
            </p>
            <p className="text-xs text-neutral-500">
              {isOrderCutoffEnforced() ? (
                <>
                  Por defecto: esta semana (lunes → hoy, hora Argentina). Las
                  ingresadas después del cierre (
                  {formatOrderCutoffHourLabel(orderCutoffHourAr)}) van arriba, en
                  una fila expansible (orden más reciente primero).
                </>
              ) : (
                <>
                  Por defecto: esta semana (lunes → hoy, hora Argentina). Orden
                  más reciente primero.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[14rem] shrink-0 flex-col gap-1 text-xs text-neutral-600">
              Período
              <DateRangePicker
                from={from}
                to={to}
                onChange={(nextFrom, nextTo) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
                aria-label="Período"
              />
            </label>

            <Button
              type="submit"
              variant="outline"
              disabled={loading}
              className="gap-2"
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
            >
              {downloading ? (
                <>
                  <Spinner className="mr-1.5 text-white" />
                  Generando…
                </>
              ) : (
                <>
                  <FileText className="mr-1.5 h-4 w-4" aria-hidden />
                  Ver PDF
                </>
              )}
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </form>
      </div>

      <SolapasTabList
        activeKey={view}
        aria-label="Vista de cotizaciones"
        size="sm"
      >
        <SolapasTabButton
          selected={view === "list"}
          onClick={() => void selectView("list")}
          size="sm"
        >
          Lista
        </SolapasTabButton>
        <SolapasTabButton
          selected={view === "product"}
          onClick={() => void selectView("product")}
          size="sm"
        >
          Por producto
        </SolapasTabButton>
      </SolapasTabList>

      {view === "list" ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar número o cliente…"
              aria-label="Buscar cotizaciones"
              className="min-w-0 flex-1"
            />
            <CotizacionesTransitionLink
              href="/admin/cotizaciones/nueva"
              className={cn(
                "inline-flex h-10 w-full shrink-0 items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white shadow-sm hover:opacity-90 sm:w-auto",
                FOCUS_BRAND_PRIMARY,
              )}
            >
              <ClipboardPlus className="mr-1.5 h-4 w-4" aria-hidden />
              Nueva cotización
            </CotizacionesTransitionLink>
          </div>

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
                    <tr className="border-t border-neutral-200 bg-amber-50/50 transition-colors hover:bg-amber-50/80">
                      <td colSpan={6} className="p-0">
                        <button
                          type="button"
                          onClick={() => setLateOpen((o) => !o)}
                          aria-expanded={lateOpen}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium text-amber-950"
                        >
                          <span>
                            {afterCutoffSummary(
                              afterCutoff.length,
                              orderCutoffHourAr,
                            )}
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
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por número o cliente…"
              aria-label="Filtrar cotizaciones por número o cliente"
              className="min-w-0 flex-1"
            />
            <Input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Buscar producto (código o nombre)…"
              aria-label="Buscar producto"
              className="min-w-0 flex-1"
            />
          </div>

          <p className="text-sm text-neutral-600">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Calculando…
              </span>
            ) : (
              <>
                {productQuoteCount}{" "}
                {productQuoteCount === 1 ? "cotización" : "cotizaciones"}
                {" · "}
                Suma productos {formatPrice(filteredProductSum)}
                {" · "}
                {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "producto" : "productos"}
              </>
            )}
          </p>
          <p className="text-xs text-neutral-500">
            Kg y unidades van separados. Las líneas “a pesar” suman unidades y
            suelen quedar en $0 hasta que el admin carga el precio. Aplicá el
            período con Filtrar lista; la búsqueda de cliente también.
          </p>

          <DataTableScroll>
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2 text-right">Kg</th>
                  <th className="px-3 py-2 text-right">Unidades</th>
                  <th className="px-3 py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((row) => (
                  <tr
                    key={row.productCode}
                    className="admin-table-row border-t border-neutral-200"
                  >
                    <td className="px-3 py-2 font-medium">{row.productCode}</td>
                    <td className="px-3 py-2">{row.productName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.qtyKg > 0 ? formatQty(row.qtyKg) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.qtyUnits > 0 ? formatQty(row.qtyUnits) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatPrice(row.amount)}
                    </td>
                  </tr>
                ))}
                {!loading && filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-neutral-500"
                    >
                      {productEmptyLabel}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </DataTableScroll>
        </>
      )}
    </div>
  );
}
