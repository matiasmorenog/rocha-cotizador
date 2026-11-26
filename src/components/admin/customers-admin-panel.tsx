"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { cn } from "@/lib/utils";
import { Pencil, UserPlus } from "lucide-react";
import {
  AdminTableActions,
  AdminTableIconAction,
} from "@/components/admin/admin-table";
import { CustomerAdminCreateModal } from "@/components/admin/customer-admin-create-modal";
import { CustomerAdminForm } from "@/components/admin/customer-admin-form";
import { AdminCustomerName } from "@/components/admin/admin-customer-name";
import { Badge } from "@/components/ui/badge";
import { AdminDraftTrigger } from "@/components/ui/admin-draft-modal";
import { DataTableScroll } from "@/components/ui/data-table";
import { SortableTh } from "@/components/ui/sortable-th";
import { Input } from "@/components/ui/input";
import { TableColumnPicker } from "@/components/ui/table-column-picker";
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
import { sortRows, useTableSort } from "@/hooks/use-table-sort";
import {
  useTableColumnVisibility,
  type TableColumnDef,
} from "@/hooks/use-table-column-visibility";
import {
  CUSTOMER_ACCOUNT_STATUS_LABELS,
  type CustomerModuleFlags,
} from "@/lib/customer-modules";
import { useModalDraftStore } from "@/stores/modal-draft-store";

const CUSTOMER_TABLE_COLUMNS: TableColumnDef[] = [
  { id: "code", label: "Código", locked: true },
  { id: "name", label: "Nombre", locked: true },
  { id: "address", label: "Dirección" },
  { id: "phone", label: "Teléfono" },
  { id: "lista", label: "Lista" },
  { id: "estado", label: "Estado" },
  { id: "actions", label: "Acciones", locked: true },
];

export type CustomerListRow = {
  id: string;
  code: string;
  name: string;
  nameNote: string | null;
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

type CustomerSortKey =
  | "code"
  | "name"
  | "address"
  | "phone"
  | "lista"
  | "estado";

export function CustomersAdminPanel({
  customers,
  priceLists,
  initialEditId,
}: {
  customers: CustomerListRow[];
  priceLists: PriceListOption[];
  initialEditId?: string | null;
}) {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const creating = useModalDraftStore((s) => s.customerCreate.open);
  const customerDraft = useModalDraftStore((s) => s.customerCreate);
  const patchCustomerCreate = useModalDraftStore((s) => s.patchCustomerCreate);
  const customerDirtyCount =
    (customerDraft.code.trim() ? 1 : 0) +
    (customerDraft.name.trim() ? 1 : 0) +
    (customerDraft.nameNote.trim() ? 1 : 0) +
    (customerDraft.address.trim() ? 1 : 0) +
    (customerDraft.phone.trim() ? 1 : 0) +
    (customerDraft.email.trim() ? 1 : 0);
  const createDraft = {
    pending: customerDraft.sessionActive && customerDirtyCount > 0,
    itemCount: customerDirtyCount,
  };
  const setCreating = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const prev = useModalDraftStore.getState().customerCreate.open;
      const next = typeof v === "function" ? v(prev) : v;
      patchCustomerCreate({ open: next });
    },
    [patchCustomerCreate],
  );
  const [editingId, setEditingId] = useState<string | null>(
    initialEditId ?? null,
  );
  const { sort, toggle } = useTableSort<CustomerSortKey>();
  const {
    toggleableColumns,
    isVisible,
    setColumnVisible,
    showAllColumns,
    colSpan,
    visibilityKey,
    hiddenCount,
  } = useTableColumnVisibility(
    "admin-customers",
    CUSTOMER_TABLE_COLUMNS,
    session?.user?.id,
  );

  const filtered = useMemo(
    () =>
      filterFoldedSearch(customers, query, {
        primary: [(c) => c.code],
        secondary: [(c) => c.name, (c) => c.nameNote ?? ""],
        emptyReturnsAll: true,
      }),
    [customers, query],
  );

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, {
        code: (c) => c.code,
        name: (c) => c.name,
        address: (c) => c.address,
        phone: (c) => c.phone,
        lista: (c) => c.priceListName ?? "Precio base",
        estado: (c) => (c.active ? 1 : 0),
      }),
    [filtered, sort],
  );

  const {
    visible,
    hasMore,
    revealMore,
    total,
  } = useIncrementalReveal(sorted, {
    initial: INCREMENTAL_REVEAL_INITIAL,
    step: INCREMENTAL_REVEAL_STEP,
    resetKey: `${query}|${sort?.key ?? ""}|${sort?.dir ?? ""}`,
  });

  const tableHeightLockRef = useRef<HTMLDivElement>(null);
  useSmoothListHeight(tableHeightLockRef, visible.length);

  const tableRef = useRef<HTMLTableElement>(null);
  useSmoothColumnWidths(
    tableRef,
    `${query}|${visible.length}|${sort?.key ?? ""}|${visibilityKey}`,
  );
  const { rowProps } = useSelectedRow(visible.map((c) => c.id));

  const editing = editingId
    ? customers.find((c) => c.id === editingId)
    : undefined;
  const showEditForm = Boolean(editing);
  const { present, exiting, animKey } = useExitPresence(showEditForm, 250);

  return (
    <div className="space-y-3">
      <CustomerAdminCreateModal
        priceLists={priceLists}
        open={creating}
        onOpenChange={(v) => {
          if (v) setEditingId(null);
          setCreating(v);
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar código o nombre…"
          aria-label="Buscar clientes"
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center gap-2">
          <TableColumnPicker
            columns={toggleableColumns}
            isVisible={isVisible}
            onChange={setColumnVisible}
            onShowAll={showAllColumns}
            hiddenCount={hiddenCount}
          />
          <AdminDraftTrigger
            onClick={() => {
              setEditingId(null);
              setCreating((v) => !v);
            }}
            pending={createDraft.pending}
            itemCount={createDraft.itemCount}
            idleLabel="Nuevo cliente"
            pendingLabel="Continuar cliente"
            icon={UserPlus}
          />
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-[250ms] ease-in"
        style={{ gridTemplateRows: present && !exiting ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          {present && editing ? (
            <div
              key={`${animKey}-${editing.id}`}
              className={cn(exiting ? "payment-form-exit" : "payment-form-enter")}
            >
              <CustomerAdminForm
                priceLists={priceLists}
                onCancel={() => setEditingId(null)}
                customer={{
                  id: editing.id,
                  code: editing.code,
                  name: editing.name,
                  nameNote: editing.nameNote,
                  priceListId: editing.priceListId,
                  address: editing.address,
                  phone: editing.phone,
                  email: editing.email,
                  notes: editing.notes,
                  paymentTerms: editing.paymentTerms,
                  deliveryHours: editing.deliveryHours,
                  active: editing.active,
                  modules: editing.modules,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div ref={tableHeightLockRef}>
        <DataTableScroll className="data-table-rows-2l">
          <table ref={tableRef} className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <SortableTh
                  label="Código"
                  sortKey="code"
                  activeKey={sort?.key}
                  dir={sort?.dir}
                  onToggle={toggle}
                />
                <SortableTh
                  label="Nombre"
                  sortKey="name"
                  activeKey={sort?.key}
                  dir={sort?.dir}
                  onToggle={toggle}
                />
                {isVisible("address") ? (
                  <SortableTh
                    label="Dirección"
                    sortKey="address"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                {isVisible("phone") ? (
                  <SortableTh
                    label="Teléfono"
                    sortKey="phone"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                    className="whitespace-nowrap"
                  />
                ) : null}
                {isVisible("lista") ? (
                  <SortableTh
                    label="Lista"
                    sortKey="lista"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                {isVisible("estado") ? (
                  <SortableTh
                    label="Estado"
                    sortKey="estado"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={colSpan}
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
                          <AdminCustomerName
                            name={c.name}
                            nameNote={c.nameNote}
                            className="admin-table-name-2l max-w-[14rem]"
                          />
                        </td>
                        {isVisible("address") ? (
                          <td className="px-3 py-2 text-neutral-700">
                            <span className="admin-table-name-2l max-w-[16rem]">
                              {c.address ?? "—"}
                            </span>
                          </td>
                        ) : null}
                        {isVisible("phone") ? (
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
                        ) : null}
                        {isVisible("lista") ? (
                          <td className="px-3 py-2">
                            {c.priceListName ?? "Precio base"}
                          </td>
                        ) : null}
                        {isVisible("estado") ? (
                          <td className="px-3 py-2">
                            <Badge variant={c.active ? "success" : "danger"}>
                              {c.active
                                ? CUSTOMER_ACCOUNT_STATUS_LABELS.enabled
                                : CUSTOMER_ACCOUNT_STATUS_LABELS.disabled}
                            </Badge>
                          </td>
                        ) : null}
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
                    colSpan={colSpan}
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
