"use client";

import { useState } from "react";
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
}: {
  entries: StockReportEntry[];
  customers: StockModuleCustomer[];
  customerId: string;
  kindLabel: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  return (
    <div className="space-y-4">
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
          {entries.map((entry) => {
            const open = openId === entry.id;
            return (
              <div
                key={entry.id}
                className="rounded-lg border border-neutral-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  onClick={() => setOpenId(open ? null : entry.id)}
                >
                  <div className="min-w-0">
                    {!selectedCustomer ? (
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {entry.customer.code} · {entry.customer.name}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "text-sm text-neutral-900",
                        !selectedCustomer
                          ? "text-xs text-neutral-500"
                          : "font-medium",
                      )}
                    >
                      {kindLabel} {entry.entryDate}
                      {entry.submittedBy ? ` · ${entry.submittedBy}` : ""}
                      {` · ${entry.lines.length} ítems`}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {open ? "Ocultar" : "Ver"}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-neutral-100 px-3 py-2">
                    {entry.notes ? (
                      <p className="mb-2 text-sm text-neutral-600">
                        {entry.notes}
                      </p>
                    ) : null}
                    <ul className="space-y-1 text-sm">
                      {entry.lines.map((line) => (
                        <li
                          key={line.productId}
                          className="flex justify-between gap-3"
                        >
                          <span className="min-w-0 truncate">
                            {line.product.name}{" "}
                            <span className="text-neutral-500">
                              ({line.product.code})
                            </span>
                          </span>
                          <span className="shrink-0 font-medium">
                            {line.qty} {line.unit}
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
