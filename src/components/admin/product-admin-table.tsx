"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, PackagePlus, Pencil, X } from "lucide-react";
import {
  AdminTableActions,
  AdminTableIconAction,
} from "@/components/admin/admin-table";
import {
  ProductAdminForm,
  type PriceListOption,
} from "@/components/admin/product-admin-form";
import { ProductTipoField } from "@/components/admin/product-tipo-field";
import {
  productOrderModeBadge,
  productOrderModeDescription,
} from "@/lib/order-measure";
import { AdminDraftTrigger } from "@/components/ui/admin-draft-modal";
import { Badge } from "@/components/ui/badge";
import {
  ENTITY_ENABLED_LABELS,
} from "@/lib/entity-status-labels";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DataTableScroll } from "@/components/ui/data-table";
import { SortableTh } from "@/components/ui/sortable-th";
import { AppSelect } from "@/components/ui/app-select";
import { TableColumnPicker } from "@/components/ui/table-column-picker";
import { sortRows, useTableSort } from "@/hooks/use-table-sort";
import { useModalDraftStore } from "@/stores/modal-draft-store";
import {
  useTableColumnVisibility,
  type TableColumnDef,
} from "@/hooks/use-table-column-visibility";
import { cn, formatArInput, formatPrice, parseArNumber } from "@/lib/utils";
import { notifyCatalogStale } from "@/lib/client-catalog-cache";
import { dispatchAdminInAppToast } from "@/lib/push-sw-client";
import {
  PRODUCT_STOCK_KIND_LABELS,
  PRODUCT_STOCK_KIND_OPTIONS,
  resolveProductStockKind,
} from "@/lib/stock-product-kind-labels";
import type { ProductStockKindValue } from "@/lib/stock-product-kind-shared";
import {
  normalizeAllowsUnitOrder,
  productSupportsUnitOrKgOrder,
} from "@/lib/stock-product-kind-shared";
import { filterFoldedSearch } from "@/lib/search-fold";
import {
  INCREMENTAL_REVEAL_INITIAL,
  INCREMENTAL_REVEAL_STEP,
  RevealMoreTableRow,
  useIncrementalReveal,
} from "@/hooks/use-incremental-reveal";
import { useSmoothListHeight } from "@/hooks/use-smooth-list-height";
import { useSmoothColumnWidths } from "@/hooks/use-smooth-column-widths";
import {
  useSelectedRow,
  type RowSelectionProps,
} from "@/hooks/use-selected-row";

function productListColumnId(listId: string): string {
  return `list:${listId}`;
}

function buildProductTableColumns(
  activeLists: PriceListOption[],
): TableColumnDef[] {
  return [
    { id: "code", label: "Código", locked: true },
    { id: "name", label: "Nombre", locked: true },
    { id: "rubro", label: "Tipo" },
    { id: "base", label: "Base" },
    ...activeLists.map((l) => ({
      id: productListColumnId(l.id),
      label: l.name,
    })),
    { id: "stock", label: "Stock" },
    { id: "available", label: "Habilitado" },
    { id: "measure", label: "Medida" },
    { id: "actions", label: "Acciones", locked: true },
  ];
}

export type ProductTableRow = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  basePrice: number;
  available: boolean;
  stockKind: "DESPERDICIO" | "CONSUMABLE" | "LOCAL_ASSET" | null;
  allowsUnitOrder: boolean;
  /** priceListId → unitPrice */
  listPrices: Record<string, number>;
};

const cellInputClass = "h-8 min-w-[5.5rem] px-2 text-sm";

function buildListPricePayload(
  lists: PriceListOption[],
  listPrices: Record<string, string>,
) {
  return lists.map((l) => {
    const raw = (listPrices[l.id] ?? "").trim();
    if (!raw) {
      return { priceListId: l.id, unitPrice: null as number | null };
    }
    return {
      priceListId: l.id,
      unitPrice: parseArNumber(raw),
    };
  });
}

function ProductEditRow({
  product,
  activeLists,
  rubros,
  onCancel,
  rowProps,
  colVisible,
}: {
  product: ProductTableRow;
  activeLists: PriceListOption[];
  rubros: string[];
  onCancel: () => void;
  rowProps?: RowSelectionProps;
  colVisible: (id: string) => boolean;
}) {
  const router = useRouter();
  const formId = `product-edit-${product.id}`;
  const [name, setName] = useState(product.name);
  const [rubro, setRubro] = useState(product.rubro ?? "");
  const [basePrice, setBasePrice] = useState(() =>
    formatArInput(product.basePrice, 2, AR_PRICE_FORMAT),
  );
  const [listPrices, setListPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of activeLists) {
      const v = product.listPrices[l.id];
      init[l.id] =
        v != null ? formatArInput(v, 2, AR_PRICE_FORMAT) : "";
    }
    return init;
  });
  const [available, setAvailable] = useState(product.available);
  const [stockKind, setStockKind] = useState<ProductStockKindValue>(() =>
    resolveProductStockKind(product.stockKind),
  );
  const [allowsUnitOrder, setAllowsUnitOrder] = useState(
    () =>
      normalizeAllowsUnitOrder(
        resolveProductStockKind(product.stockKind),
        product.allowsUnitOrder,
      ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const listPricePayload = buildListPricePayload(activeLists, listPrices);

    for (const row of listPricePayload) {
      if (
        row.unitPrice !== null &&
        (!Number.isFinite(row.unitPrice) || row.unitPrice < 0)
      ) {
        setError("Precio de lista inválido");
        setLoading(false);
        return;
      }
    }

    const base = parseArNumber(basePrice);
    if (!Number.isFinite(base) || base < 0) {
      setError("Precio base inválido");
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError("Nombre requerido");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          code: product.code,
          name,
          rubro,
          basePrice: base,
          available,
          stockKind,
          allowsUnitOrder: productSupportsUnitOrKgOrder(stockKind)
            ? allowsUnitOrder
            : false,
          listPrices: listPricePayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `No se pudo guardar el producto (HTTP ${res.status}).`;
        setError(detail);
        dispatchAdminInAppToast({
          title: "Error al guardar producto",
          body: detail,
          tone: "error",
        });
        return;
      }

      const savedLabel = `${name.trim()} (${product.code})`;
      dispatchAdminInAppToast({
        title: "Producto actualizado",
        body: savedLabel,
        tone: "success",
      });
      notifyCatalogStale();
      onCancel();
      router.refresh();
    } catch {
      const detail = "No se pudo conectar con el servidor. Revisá tu conexión.";
      setError(detail);
      dispatchAdminInAppToast({
        title: "Error al guardar producto",
        body: detail,
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr
      {...rowProps}
      tabIndex={0}
      className="admin-table-row border-t border-neutral-100 bg-neutral-50/60"
    >
      <td className="px-3 py-2 font-mono text-neutral-700">
        {product.code}
        <form id={formId} onSubmit={onSubmit} className="hidden" />
      </td>
      <td className="px-3 py-2">
        <Input
          form={formId}
          className={cellInputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
          aria-label="Nombre"
        />
      </td>
      {colVisible("rubro") ? (
        <td className="px-3 py-2">
          <ProductTipoField
            rubros={rubros}
            value={rubro}
            onChange={setRubro}
            form={formId}
            disabled={loading}
            compact
          />
        </td>
      ) : null}
      {colVisible("base") ? (
        <td className="px-3 py-2">
          <ArNumberInput
            form={formId}
            className={cn(cellInputClass, "min-w-[6rem] font-mono")}
            value={basePrice}
            onValueChange={setBasePrice}
            maxFractionDigits={2}
            formatOptions={AR_PRICE_FORMAT}
            required
            disabled={loading}
            aria-label="Precio base"
          />
        </td>
      ) : null}
      {activeLists.map((l) =>
        colVisible(productListColumnId(l.id)) ? (
          <td key={l.id} className="px-3 py-2">
            <ArNumberInput
              form={formId}
              className={cn(cellInputClass, "min-w-[6rem] font-mono")}
              value={listPrices[l.id] ?? ""}
              onValueChange={(raw) =>
                setListPrices((prev) => ({ ...prev, [l.id]: raw }))
              }
              maxFractionDigits={2}
              formatOptions={AR_PRICE_FORMAT}
              placeholder="—"
              disabled={loading}
              aria-label={`Precio ${l.name}`}
            />
          </td>
        ) : null,
      )}
      {colVisible("stock") ? (
        <td className="px-3 py-2">
          <AppSelect
            form={formId}
            value={stockKind}
            onChange={(nextKind) => {
              setStockKind(nextKind);
              if (!productSupportsUnitOrKgOrder(nextKind)) {
                setAllowsUnitOrder(false);
              }
            }}
            disabled={loading}
            size="sm"
            className="max-w-[9rem]"
            aria-label="Tipo de stock"
            options={PRODUCT_STOCK_KIND_OPTIONS.map((kind) => ({
              value: kind,
              label: PRODUCT_STOCK_KIND_LABELS[kind],
            }))}
          />
        </td>
      ) : null}
      {colVisible("available") ? (
        <td className="px-3 py-2">
          <label
            className="inline-flex cursor-pointer items-center gap-2"
            title={
              available
                ? ENTITY_ENABLED_LABELS.enabled
                : ENTITY_ENABLED_LABELS.disabled
            }
          >
            <Switch
              form={formId}
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              disabled={loading}
              aria-label={ENTITY_ENABLED_LABELS.enabled}
            />
          </label>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </td>
      ) : null}
      {colVisible("measure") ? (
        <td className="px-3 py-2">
          {productSupportsUnitOrKgOrder(stockKind) ? (
            <label
              className="inline-flex cursor-pointer items-center gap-2"
              title={productOrderModeDescription(allowsUnitOrder)}
            >
              <Switch
                form={formId}
                checked={allowsUnitOrder}
                onChange={(e) => setAllowsUnitOrder(e.target.checked)}
                disabled={loading}
                aria-label="Permite pedido por unidades"
              />
            </label>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </td>
      ) : null}
      <td className="px-3 py-2 text-right">
        <AdminTableActions className="justify-end">
          <AdminTableIconAction
            label="Guardar"
            icon={Check}
            type="submit"
            form={formId}
            variant="primary"
            loading={loading}
          />
          <AdminTableIconAction
            label="Cancelar"
            icon={X}
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          />
        </AdminTableActions>
        {!colVisible("available") && error ? (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        ) : null}
      </td>
    </tr>
  );
}

function ProductViewRow({
  product,
  activeLists,
  editDisabled,
  onStartEdit,
  rowProps,
  colVisible,
}: {
  product: ProductTableRow;
  activeLists: PriceListOption[];
  editDisabled: boolean;
  onStartEdit: () => void;
  rowProps?: RowSelectionProps;
  colVisible: (id: string) => boolean;
}) {
  return (
    <tr {...rowProps} tabIndex={0} className="admin-table-row border-t border-neutral-100">
      <td className="px-3 py-2 font-mono">{product.code}</td>
      <td className="px-3 py-2">
        <span className="admin-table-name-2l max-w-[18rem]">
          {product.name}
        </span>
      </td>
      {colVisible("rubro") ? (
        <td className="px-3 py-2 text-neutral-600">{product.rubro ?? "—"}</td>
      ) : null}
      {colVisible("base") ? (
        <td className="px-3 py-2">{formatPrice(product.basePrice)}</td>
      ) : null}
      {activeLists.map((l) => {
        if (!colVisible(productListColumnId(l.id))) return null;
        const price = product.listPrices[l.id];
        return (
          <td key={l.id} className="px-3 py-2 text-neutral-700">
            {price != null ? formatPrice(price) : "—"}
          </td>
        );
      })}
      {colVisible("stock") ? (
        <td className="px-3 py-2">
          <Badge variant="default">
            {
              PRODUCT_STOCK_KIND_LABELS[
                resolveProductStockKind(product.stockKind)
              ]
            }
          </Badge>
        </td>
      ) : null}
      {colVisible("available") ? (
        <td className="px-3 py-2">
          <Badge variant={product.available ? "success" : "danger"}>
            {product.available
              ? ENTITY_ENABLED_LABELS.enabled
              : ENTITY_ENABLED_LABELS.disabled}
          </Badge>
        </td>
      ) : null}
      {colVisible("measure") ? (
        <td className="px-3 py-2">
          {(() => {
            const effectiveAllows = normalizeAllowsUnitOrder(
              resolveProductStockKind(product.stockKind),
              product.allowsUnitOrder,
            );
            return (
              <Badge variant={effectiveAllows ? "success" : "default"}>
                {productOrderModeBadge(effectiveAllows)}
              </Badge>
            );
          })()}
        </td>
      ) : null}
      <td className="px-3 py-2 text-right">
        <AdminTableActions className="justify-end">
          <AdminTableIconAction
            label="Editar"
            icon={Pencil}
            onClick={() => {
              if (editDisabled) return;
              onStartEdit();
            }}
            blocked={editDisabled}
          />
        </AdminTableActions>
      </td>
    </tr>
  );
}

export function ProductAdminTable({
  products,
  priceLists,
  rubros,
}: {
  products: ProductTableRow[];
  priceLists: PriceListOption[];
  /** Uniq Tipo options derived from the loaded product list. */
  rubros: string[];
}) {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const creating = useModalDraftStore((s) => s.productCreate.open);
  const productSessionActive = useModalDraftStore(
    (s) => s.productCreate.sessionActive,
  );
  const productDraft = useModalDraftStore((s) => s.productCreate);
  const patchProductCreate = useModalDraftStore((s) => s.patchProductCreate);
  const productDirtyCount =
    (productDraft.code.trim() ? 1 : 0) +
    (productDraft.name.trim() ? 1 : 0) +
    (productDraft.rubro.trim() ? 1 : 0) +
    (productDraft.basePrice.trim() ? 1 : 0);
  const createDraft = {
    pending: productSessionActive && productDirtyCount > 0,
    itemCount: productDirtyCount,
  };
  const setCreating = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const prev = useModalDraftStore.getState().productCreate.open;
      const next = typeof v === "function" ? v(prev) : v;
      patchProductCreate({ open: next });
    },
    [patchProductCreate],
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const activeLists = priceLists.filter((l) => l.active);
  const tableColumns = useMemo(
    () => buildProductTableColumns(activeLists),
    [activeLists],
  );
  const {
    toggleableColumns,
    isVisible,
    setColumnVisible,
    showAllColumns,
    colSpan,
    visibilityKey,
    hiddenCount,
  } = useTableColumnVisibility(
    "admin-products",
    tableColumns,
    session?.user?.id,
  );
  const isBusy = editingId !== null;
  const { sort, toggle } = useTableSort<string>();

  const filtered = useMemo(
    () =>
      filterFoldedSearch(products, query, {
        primary: [(p) => p.code],
        secondary: [(p) => p.name, (p) => p.rubro],
        emptyReturnsAll: true,
      }),
    [products, query],
  );

  const sorted = useMemo(() => {
    const getters: Record<
      string,
      (p: ProductTableRow) => string | number | boolean | null
    > = {
      code: (p) => p.code,
      name: (p) => p.name,
      rubro: (p) => p.rubro,
      base: (p) => p.basePrice,
      stock: (p) =>
        PRODUCT_STOCK_KIND_LABELS[resolveProductStockKind(p.stockKind)],
      available: (p) => (p.available ? 1 : 0),
      measure: (p) =>
        normalizeAllowsUnitOrder(
          resolveProductStockKind(p.stockKind),
          p.allowsUnitOrder,
        )
          ? 1
          : 0,
    };
    for (const list of activeLists) {
      getters[`list:${list.id}`] = (p) => p.listPrices[list.id] ?? null;
    }
    return sortRows(filtered, sort, getters);
  }, [filtered, sort, activeLists]);

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
  const { rowProps } = useSelectedRow(visible.map((p) => p.id));

  return (
    <div className="space-y-3">
      <ProductAdminForm
        rubros={rubros}
        open={creating}
        onOpenChange={setCreating}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar código, nombre o tipo…"
          aria-label="Buscar productos"
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
            onClick={() => setCreating((v) => !v)}
            pending={createDraft.pending}
            itemCount={createDraft.itemCount}
            idleLabel="Nuevo producto"
            pendingLabel="Continuar producto"
            icon={PackagePlus}
          />
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
                {isVisible("rubro") ? (
                  <SortableTh
                    label="Tipo"
                    sortKey="rubro"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                {isVisible("base") ? (
                  <SortableTh
                    label="Base"
                    sortKey="base"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                {activeLists.map((l) =>
                  isVisible(productListColumnId(l.id)) ? (
                    <SortableTh
                      key={l.id}
                      label={l.name}
                      sortKey={productListColumnId(l.id)}
                      activeKey={sort?.key}
                      dir={sort?.dir}
                      onToggle={toggle}
                      className="whitespace-nowrap"
                    />
                  ) : null,
                )}
                {isVisible("stock") ? (
                  <SortableTh
                    label="Stock"
                    sortKey="stock"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                {isVisible("available") ? (
                  <SortableTh
                    label="Habilitado"
                    sortKey="available"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                {isVisible("measure") ? (
                  <SortableTh
                    label="Medida"
                    sortKey="measure"
                    activeKey={sort?.key}
                    dir={sort?.dir}
                    onToggle={toggle}
                  />
                ) : null}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) =>
                editingId === p.id ? (
                  <ProductEditRow
                    key={p.id}
                    product={p}
                    activeLists={activeLists}
                    rubros={rubros}
                    onCancel={() => setEditingId(null)}
                    rowProps={rowProps(p.id)}
                    colVisible={isVisible}
                  />
                ) : (
                  <ProductViewRow
                    key={p.id}
                    product={p}
                    activeLists={activeLists}
                    editDisabled={isBusy}
                    onStartEdit={() => setEditingId(p.id)}
                    rowProps={rowProps(p.id)}
                    colVisible={isVisible}
                  />
                ),
              )}
              <RevealMoreTableRow
                colSpan={colSpan}
                enabled={hasMore}
                onReveal={revealMore}
                shown={visible.length}
                total={total}
              />
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-3 py-8 text-center text-neutral-500"
                  >
                    {query.trim()
                      ? "Sin productos para esa búsqueda"
                      : "No hay productos"}
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
