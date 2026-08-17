"use client";

import { useMemo, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  AdminTableActions,
  AdminTableIconAction,
} from "@/components/admin/admin-table";
import { CustomerAdminForm } from "@/components/admin/customer-admin-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableScroll } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { whatsappUrl } from "@/lib/whatsapp";
import { filterFoldedSearch } from "@/lib/search-fold";
import {
  INCREMENTAL_REVEAL_INITIAL,
  INCREMENTAL_REVEAL_STEP,
  RevealMoreTableRow,
  useIncrementalReveal,
} from "@/hooks/use-incremental-reveal";
import { useSmoothListHeight } from "@/hooks/use-smooth-list-height";
import { useSmoothColumnWidths } from "@/hooks/use-smooth-column-widths";
import { useSelectedRow } from "@/hooks/use-selected-row";
import type { CustomerModuleFlags } from "@/lib/customer-modules";

export type CustomerListRow = {
  id: string;
  code: string;
  name: string;
  priceListId: string | null;
  priceListName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  paymentTerms: string | null;
  deliveryHours: string | null;
  active: boolean;
  modules: CustomerModuleFlags;
};

export type PriceListOption = {
  id: string;
  name: string;
  active: boolean;
  isBase?: boolean;
};

export function CustomersAdminPanel({
  customers,
  priceLists,
  initialEditId,
}: {
  customers: CustomerListRow[];
  priceLists: PriceListOption[];
  initialEditId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(
    initialEditId ?? null,
  );

  const filtered = useMemo(
    () =>
      filterFoldedSearch(customers, query, {
        primary: [(c) => c.code],
        secondary: [(c) => c.name],
        emptyReturnsAll: true,
      }),
    [customers, query],
  );

  const {
    visible,
    hasMore,
    revealMore,
    total,
  } = useIncrementalReveal(filtered, {
    initial: INCREMENTAL_REVEAL_INITIAL,
    step: INCREMENTAL_REVEAL_STEP,
    resetKey: query,
  });

  const tableHeightLockRef = useRef<HTMLDivElement>(null);
  useSmoothListHeight(tableHeightLockRef, visible.length);

  const tableRef = useRef<HTMLTableElement>(null);
  useSmoothColumnWidths(tableRef, `${query}|${visible.length}`);
  const { rowProps } = useSelectedRow(visible.map((c) => c.id));

  const editing = editingId
    ? customers.find((c) => c.id === editingId)
    : undefined;
  const showForm = Boolean(editing) || creating;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar código o nombre…"
          aria-label="Buscar clientes"
          className="min-w-0 flex-1"
        />
        {!showForm ? (
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => {
              setEditingId(null);
              setCreating(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Nuevo cliente
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <CustomerAdminForm
          key={editing?.id ?? "new"}
          priceLists={priceLists}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
          customer={
            editing
              ? {
                  id: editing.id,
                  code: editing.code,
                  name: editing.name,
                  priceListId: editing.priceListId,
                  address: editing.address,
                  phone: editing.phone,
                  email: editing.email,
                  notes: editing.notes,
                  paymentTerms: editing.paymentTerms,
                  deliveryHours: editing.deliveryHours,
                  active: editing.active,
                  modules: editing.modules,
                }
              : undefined
          }
        />
      ) : null}

      <div ref={tableHeightLockRef}>
        <DataTableScroll className="data-table-rows-2l">
          <table ref={tableRef} className="w-full min-w-[40rem] text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Dirección</th>
                <th className="px-3 py-2 whitespace-nowrap">Teléfono</th>
                <th className="px-3 py-2">Lista</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-neutral-500"
                  >
                    {query.trim()
                      ? "Sin clientes para esa búsqueda"
                      : "Sin clientes"}
                  </td>
                </tr>
              ) : (
                <>
                  {visible.map((c) => {
                    const wa = c.phone ? whatsappUrl(c.phone) : null;
                    return (
                      <tr
                        key={c.id}
                        {...rowProps(c.id)}
                        tabIndex={0}
                        className="admin-table-row border-t border-neutral-100"
                      >
                        <td className="px-3 py-2 font-mono">{c.code}</td>
                        <td className="px-3 py-2">
                          <span className="admin-table-name-2l max-w-[14rem]">
                            {c.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-neutral-700">
                          <span className="admin-table-name-2l max-w-[16rem]">
                            {c.address ?? "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-neutral-700">
                          {c.phone && wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--brand-primary)] underline hover:opacity-80"
                            >
                              {c.phone}
                            </a>
                          ) : (
                            (c.phone ?? "—")
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {c.priceListName ?? "Precio base"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={c.active ? "success" : "danger"}>
                            {c.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <AdminTableActions className="justify-end">
                            <AdminTableIconAction
                              label="Editar"
                              icon={Pencil}
                              onClick={() => {
                                setCreating(false);
                                setEditingId(c.id);
                              }}
                            />
                          </AdminTableActions>
                        </td>
                      </tr>
                    );
                  })}
                  <RevealMoreTableRow
                    colSpan={7}
                    enabled={hasMore}
                    onReveal={revealMore}
                    shown={visible.length}
                    total={total}
                  />
                </>
              )}
            </tbody>
          </table>
        </DataTableScroll>
      </div>
    </div>
  );
}
