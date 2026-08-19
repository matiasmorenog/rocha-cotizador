"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DataTableScroll } from "@/components/ui/data-table";
import { cn, formatArInput, formatPrice, parseArNumber } from "@/lib/utils";
import { notifyCatalogStale } from "@/lib/client-catalog-cache";
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

export type ProductTableRow = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  basePrice: number;
  active: boolean;
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
}: {
  product: ProductTableRow;
  activeLists: PriceListOption[];
  rubros: string[];
  onCancel: () => void;
  rowProps?: RowSelectionProps;
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
  const [active, setActive] = useState(product.active);
  const [allowsUnitOrder, setAllowsUnitOrder] = useState(product.allowsUnitOrder);
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

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        code: product.code,
        name,
        rubro,
        basePrice: base,
        active,
        allowsUnitOrder,
        listPrices: listPricePayload,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    notifyCatalogStale();
    onCancel();
    router.refresh();
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
      {activeLists.map((l) => (
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
      ))}
      <td className="px-3 py-2">
        <label
          className="inline-flex cursor-pointer items-center gap-2"
          title={active ? "Activo" : "Inactivo"}
        >
          <Switch
            form={formId}
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={loading}
            aria-label="Activo"
          />
        </label>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </td>
      <td className="px-3 py-2">
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
      </td>
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
}: {
  product: ProductTableRow;
  activeLists: PriceListOption[];
  editDisabled: boolean;
  onStartEdit: () => void;
  rowProps?: RowSelectionProps;
}) {
  return (
    <tr {...rowProps} tabIndex={0} className="admin-table-row border-t border-neutral-100">
      <td className="px-3 py-2 font-mono">{product.code}</td>
      <td className="px-3 py-2">
        <span className="admin-table-name-2l max-w-[18rem]">
          {product.name}
        </span>
      </td>
      <td className="px-3 py-2 text-neutral-600">{product.rubro ?? "—"}</td>
      <td className="px-3 py-2">{formatPrice(product.basePrice)}</td>
      {activeLists.map((l) => {
        const price = product.listPrices[l.id];
        return (
          <td key={l.id} className="px-3 py-2 text-neutral-700">
            {price != null ? formatPrice(price) : "—"}
          </td>
        );
      })}
      <td className="px-3 py-2">
        <Badge variant={product.active ? "success" : "danger"}>
          {product.active ? "Activo" : "Inactivo"}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <Badge variant={product.allowsUnitOrder ? "success" : "default"}>
          {productOrderModeBadge(product.allowsUnitOrder)}
        </Badge>
      </td>
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
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const activeLists = priceLists.filter((l) => l.active);
  const isBusy = editingId !== null;

  const filtered = useMemo(
    () =>
      filterFoldedSearch(products, query, {
        primary: [(p) => p.code],
        secondary: [(p) => p.name, (p) => p.rubro],
        emptyReturnsAll: true,
      }),
    [products, query],
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
  const { rowProps } = useSelectedRow(visible.map((p) => p.id));

  const colSpan = 6 + activeLists.length;
  const { present: formPresent, exiting: formExiting, animKey: formAnimKey } = useExitPresence(creating, 250);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar código, nombre o tipo…"
          aria-label="Buscar productos"
          className="min-w-0 flex-1"
        />
        {!creating ? (
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setCreating(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Nuevo producto
          </Button>
        ) : null}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-[250ms] ease-in"
        style={{ gridTemplateRows: formPresent ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden min-h-0">
          {formPresent ? (
            <div
              key={formAnimKey}
              className={cn(formExiting ? "payment-form-exit" : "payment-form-enter")}
            >
              <ProductAdminForm
                rubros={rubros}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div ref={tableHeightLockRef}>
        <DataTableScroll className="data-table-rows-2l">
          <table ref={tableRef} className="w-full min-w-[36rem] text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Base</th>
                {activeLists.map((l) => (
                  <th key={l.id} className="whitespace-nowrap px-3 py-2">
                    {l.name}
                  </th>
                ))}
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Medida</th>
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
                  />
                ) : (
                  <ProductViewRow
                    key={p.id}
                    product={p}
                    activeLists={activeLists}
                    editDisabled={isBusy}
                    onStartEdit={() => setEditingId(p.id)}
                    rowProps={rowProps(p.id)}
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
              {filtered.length === 0 ? (
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
