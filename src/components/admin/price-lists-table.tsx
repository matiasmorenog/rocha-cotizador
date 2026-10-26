"use client";

import { useMemo } from "react";
import { ENTITY_ENABLED_FEMININE_LABELS } from "@/lib/entity-status-labels";
import { Badge } from "@/components/ui/badge";
import { DataTableScroll } from "@/components/ui/data-table";
import { SortableTh } from "@/components/ui/sortable-th";
import { PriceListRowActions } from "@/components/admin/price-list-row-actions";
import { sortRows, useTableSort } from "@/hooks/use-table-sort";

export type PriceListTableRow = {
  id: string;
  name: string;
  excelKey: string | null;
  itemCount: number;
  customerCount: number;
  active: boolean;
  isBase: boolean;
};

type SortKey = "name" | "excel" | "productos" | "clientes" | "estado";

export function PriceListsTable({ lists }: { lists: PriceListTableRow[] }) {
  const { sort, toggle } = useTableSort<SortKey>();
  const sorted = useMemo(
    () =>
      sortRows(lists, sort, {
        name: (l) => l.name,
        excel: (l) => l.excelKey,
        productos: (l) => l.itemCount,
        clientes: (l) => l.customerCount,
        estado: (l) => (l.active ? 1 : 0),
      }),
    [lists, sort],
  );

  return (
    <DataTableScroll className="data-table-rows-2l">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr>
            <SortableTh
              label="Nombre"
              sortKey="name"
              activeKey={sort?.key}
              dir={sort?.dir}
              onToggle={toggle}
            />
            <SortableTh
              label="Excel"
              sortKey="excel"
              activeKey={sort?.key}
              dir={sort?.dir}
              onToggle={toggle}
            />
            <SortableTh
              label="Productos"
              sortKey="productos"
              activeKey={sort?.key}
              dir={sort?.dir}
              onToggle={toggle}
            />
            <SortableTh
              label="Clientes"
              sortKey="clientes"
              activeKey={sort?.key}
              dir={sort?.dir}
              onToggle={toggle}
            />
            <SortableTh
              label="Estado"
              sortKey="estado"
              activeKey={sort?.key}
              dir={sort?.dir}
              onToggle={toggle}
            />
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) => (
            <tr key={l.id} className="border-t border-neutral-100">
              <td className="px-3 py-2 font-medium">{l.name}</td>
              <td className="px-3 py-2 font-mono text-neutral-600">
                {l.excelKey ?? "—"}
              </td>
              <td className="px-3 py-2">{l.itemCount}</td>
              <td className="px-3 py-2">{l.customerCount}</td>
              <td className="px-3 py-2">
                <Badge variant={l.active ? "success" : "danger"}>
                  {l.active
                    ? ENTITY_ENABLED_FEMININE_LABELS.enabled
                    : ENTITY_ENABLED_FEMININE_LABELS.disabled}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right">
                <PriceListRowActions
                  id={l.id}
                  name={l.name}
                  customerCount={l.customerCount}
                  isBase={l.isBase}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableScroll>
  );
}
