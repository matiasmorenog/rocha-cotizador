"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StockTab } from "@/lib/admin-stock-data";
import type { StockSummaryPayload } from "@/lib/admin-stock-summary-shared";
import { ADMIN_STOCK_SUMMARY_REFRESH_EVENT } from "@/lib/admin-stock-summary-refresh";
import { AdminStockSummaryChart } from "@/components/admin/admin-stock-summary-chart";
import { DataTableScroll } from "@/components/ui/data-table";
import { cn, formatPrice, formatQty } from "@/lib/utils";
import { formatDeliveryDateDisplay, parseDateOnlyYmd } from "@/lib/delivery-date";

function formatLastEntryDate(value: string | null): string {
  if (!value) return "—";
  const date = parseDateOnlyYmd(value);
  if (!date) return value;
  return formatDeliveryDateDisplay(date);
}

function stockFilterHref(input: {
  tab: StockTab;
  from: string;
  to: string;
  customerId: string;
  productId?: string;
}): string {
  const params = new URLSearchParams({ tab: input.tab });
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.customerId) params.set("customer", input.customerId);
  if (input.productId) params.set("product", input.productId);
  return `/admin/stock?${params.toString()}`;
}

export function AdminStockSummarySection({
  tab,
  from,
  to,
  customerId,
  productId = "",
  productLabel,
}: {
  tab: StockTab;
  from: string;
  to: string;
  customerId: string;
  productId?: string;
  productLabel?: string;
}) {
  const router = useRouter();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const fetchKey = `${tab}:${from}:${to}:${customerId}:${productId}:${refreshNonce}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: StockSummaryPayload | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const loading = snapshot.key !== fetchKey;
  /** Keep last successful payload while refetching — blur instead of empty flash. */
  const data = snapshot.data;
  const error =
    !loading && snapshot.key === fetchKey ? snapshot.error : null;
  const showStaleBlur = loading && data != null;

  useEffect(() => {
    const bump = () => setRefreshNonce((n) => n + 1);
    window.addEventListener(ADMIN_STOCK_SUMMARY_REFRESH_EVENT, bump);
    return () =>
      window.removeEventListener(ADMIN_STOCK_SUMMARY_REFRESH_EVENT, bump);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({ tab, from, to });
    if (customerId) params.set("customerId", customerId);
    if (productId) params.set("productId", productId);

    fetch(`/api/admin/stock/summary?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "No se pudo cargar el resumen");
        }
        return res.json() as Promise<StockSummaryPayload>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setSnapshot({ key: fetchKey, data: payload, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSnapshot((prev) => ({
          key: fetchKey,
          data: prev.data,
          error:
            err instanceof Error ? err.message : "No se pudo cargar el resumen",
        }));
      });

    return () => controller.abort();
  }, [fetchKey, tab, from, to, customerId, productId]);

  const filterHint = [
    `${from} — ${to}`,
    customerId ? "sucursal filtrada" : "todas las sucursales",
    productLabel ? `producto ${productLabel}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Resumen</h2>
        <p className="text-sm text-neutral-600">
          Cantidades y costo a precio base ({filterHint}).
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading && !data ? (
        <p className="text-sm text-neutral-500">Cargando resumen…</p>
      ) : data ? (
        <div
          aria-busy={loading || undefined}
          className={cn(
            "space-y-6 transition-[filter,opacity] duration-200",
            showStaleBlur &&
              "pointer-events-none select-none opacity-70 blur-[2px]",
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              label="Entradas en el período"
              value={String(data.entryCount)}
            />
            <SummaryCard
              label="Productos distintos"
              value={String(data.distinctProducts)}
            />
            <SummaryCard
              label="Mercadería contada (precio base)"
              value={formatPrice(data.totalBaseCost)}
              hint={`Promedio ${formatPrice(data.avgBaseCostPerDay)} / día`}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-neutral-900">
                Por producto
              </h3>
              <p className="text-xs text-neutral-500">
                {productId
                  ? "Click de nuevo en la fila para quitar el filtro."
                  : "Click en una fila para filtrar resumen e historial."}
              </p>
            </div>
            {data.products.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Sin líneas en el período con los filtros actuales.
              </p>
            ) : (
              <DataTableScroll className="data-table-rows-2l">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Cantidad
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Precio base
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Costo período
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Promedio / día (costo)
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Última carga
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((row) => {
                      const selected = productId === row.productId;
                      return (
                        <tr
                          key={`${row.productId}-${row.unit}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          aria-label={
                            selected
                              ? `Quitar filtro de ${row.code} ${row.name}`
                              : `Filtrar por ${row.code} ${row.name}`
                          }
                          className={cn(
                            "admin-table-row cursor-pointer border-t border-neutral-100",
                            selected && "bg-[var(--brand-primary-soft)]",
                          )}
                          onClick={() => {
                            router.push(
                              stockFilterHref({
                                tab,
                                from,
                                to,
                                customerId,
                                productId: selected
                                  ? undefined
                                  : row.productId,
                              }),
                              { scroll: false },
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            router.push(
                              stockFilterHref({
                                tab,
                                from,
                                to,
                                customerId,
                                productId: selected
                                  ? undefined
                                  : row.productId,
                              }),
                              { scroll: false },
                            );
                          }}
                        >
                          <td className="px-3 py-2">
                            <p className="font-medium text-neutral-900">
                              {row.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {row.code}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-neutral-900">
                            {formatQty(row.totalQty)} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                            {formatPrice(row.basePrice)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-neutral-900">
                            {formatPrice(row.totalCost)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                            {formatPrice(row.avgCostPerDay)}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-600">
                            {formatLastEntryDate(row.lastEntryDate)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTableScroll>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-900">
              Evolución diaria
            </h3>
            <AdminStockSummaryChart daily={data.daily} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums text-neutral-900",
          hint && "text-lg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
