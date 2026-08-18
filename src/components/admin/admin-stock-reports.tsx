"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import type { StockModuleCustomer } from "@/lib/admin-stock-data";
import { cn } from "@/lib/utils";

export type StockReportEntry = {
  id: string;
  entryDate: string;
  notes: string | null;
  submittedBy: string | null;
  customer: { code: string; name: string };
  lines: Array<{
    productId: string;
    qty: number;
    unit: string;
    product: {
      code: string;
      name: string;
      rubro: string | null;
    };
  }>;
};

export function AdminStockReports({
  entries,
  customers,
  customerId,
  kindLabel,
  from,
  to,
  tab,
}: {
  entries: StockReportEntry[];
  customers: StockModuleCustomer[];
  customerId: string;
  kindLabel: string;
  from: string;
  to: string;
  tab?: "elaborados" | "consumibles";
}) {
  const router = useRouter();
  const [fromLocal, setFromLocal] = useState(from);
  const [toLocal, setToLocal] = useState(to);
  const [customerLocal, setCustomerLocal] = useState(customerId);
  const [openId, setOpenId] = useState<string | null>(null);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  function applyFilter() {
    const params = new URLSearchParams();
    if (tab) params.set("tab", tab);
    if (fromLocal) params.set("from", fromLocal);
    if (toLocal) params.set("to", toLocal);
    if (customerLocal) params.set("customer", customerLocal);
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Sucursal / cliente</Label>
          <select
            className={cn(
              "h-10 w-full min-w-[14rem] rounded-md border border-neutral-200 bg-white px-3 text-sm",
              FOCUS_BRAND_BORDER,
            )}
            value={customerLocal}
            onChange={(e) => setCustomerLocal(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input
            type="date"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
          />
        </div>
        <Button type="button" onClick={applyFilter}>
          Filtrar
        </Button>
      </div>

      {selectedCustomer ? (
        <p className="text-sm font-medium text-neutral-800">
          {selectedCustomer.code} · {selectedCustomer.name}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {selectedCustomer
            ? "Sin cargas para esta sucursal con los filtros actuales."
            : "Sin cargas todavía."}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const open = openId === e.id;
            return (
              <div
                key={e.id}
                className="rounded-lg border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  onClick={() => setOpenId(open ? null : e.id)}
                >
                  <div className="min-w-0">
                    {!selectedCustomer ? (
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {e.customer.code} · {e.customer.name}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "text-sm text-neutral-900",
                        !selectedCustomer ? "text-xs text-neutral-500" : "font-medium",
                      )}
                    >
                      {kindLabel} {e.entryDate}
                      {e.submittedBy ? ` · ${e.submittedBy}` : ""}
                      {` · ${e.lines.length} ítems`}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {open ? "Ocultar" : "Ver"}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-neutral-100 px-3 py-2">
                    {e.notes ? (
                      <p className="mb-2 text-sm text-neutral-600">{e.notes}</p>
                    ) : null}
                    <ul className="space-y-1 text-sm">
                      {e.lines.map((l) => (
                        <li
                          key={l.productId}
                          className="flex justify-between gap-3"
                        >
                          <span className="min-w-0 truncate">
                            {l.product.name}{" "}
                            <span className="text-neutral-500">
                              ({l.product.code})
                            </span>
                          </span>
                          <span className="shrink-0 font-medium">
                            {l.qty} {l.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
