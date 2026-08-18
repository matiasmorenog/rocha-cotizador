"use client";

import { useEffect, useState } from "react";
import type { StockTab } from "@/lib/admin-stock-data";
import type { StockSummaryPayload } from "@/lib/admin-stock-summary-shared";
import { AdminStockSummaryChart } from "@/components/admin/admin-stock-summary-chart";
import { cn, formatPrice } from "@/lib/utils";
import { formatDeliveryDateDisplay, parseDateOnlyYmd } from "@/lib/delivery-date";

function formatLastEntryDate(value: string | null): string {
  if (!value) return "—";
  const date = parseDateOnlyYmd(value);
  if (!date) return value;
  return formatDeliveryDateDisplay(date);
}

export function AdminStockSummarySection({
  tab,
  from,
  to,
  customerId,
}: {
  tab: StockTab;
  from: string;
  to: string;
  customerId: string;
}) {
  const fetchKey = `${tab}:${from}:${to}:${customerId}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: StockSummaryPayload | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const loading = snapshot.key !== fetchKey;
  const data = snapshot.key === fetchKey ? snapshot.data : null;
  const error = snapshot.key === fetchKey ? snapshot.error : null;

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({ tab, from, to });
    if (customerId) params.set("customerId", customerId);

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
        setSnapshot({
          key: fetchKey,
          data: null,
          error:
            err instanceof Error ? err.message : "No se pudo cargar el resumen",
        });
      });

    return () => controller.abort();
  }, [fetchKey, tab, from, to, customerId]);

  return (
    <div className="space-y-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Resumen</h2>
        <p className="text-sm text-neutral-600">
          Costo de mercadería contada a precio base ({from} — {to}
          {customerId ? ", sucursal filtrada" : ", todas las sucursales"}).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando resumen…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
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
            <h3 className="text-sm font-medium text-neutral-900">
              Por producto
            </h3>
            {data.products.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Sin líneas en el período con los filtros actuales.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Precio base
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Costo período
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Promedio / día
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Última carga
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((row) => (
                      <tr
                        key={`${row.productId}-${row.unit}`}
                        className="border-t border-neutral-100"
                      >
                        <td className="px-3 py-2">
                          <p className="font-medium text-neutral-900">
                            {row.name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {row.code} · {row.unit}
                          </p>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-900">
              Evolución diaria
            </h3>
            <AdminStockSummaryChart daily={data.daily} />
          </div>
        </>
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
