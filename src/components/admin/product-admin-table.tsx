"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import {
  AdminTableActions,
  AdminTableIconAction,
} from "@/components/admin/admin-table";
import type { PriceListOption } from "@/components/admin/product-admin-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DataTableScroll } from "@/components/ui/data-table";
import { cn, formatPrice } from "@/lib/utils";

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
      unitPrice: Number(raw.replace(",", ".")),
    };
  });
}

function ProductEditRow({
  product,
  activeLists,
  onCancel,
}: {
  product: ProductTableRow;
  activeLists: PriceListOption[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const formId = `product-edit-${product.id}`;
  const [name, setName] = useState(product.name);
  const [rubro, setRubro] = useState(product.rubro ?? "");
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [listPrices, setListPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of activeLists) {
      const v = product.listPrices[l.id];
      init[l.id] = v != null ? String(v) : "";
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

    const base = Number(basePrice.replace(",", "."));
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
    onCancel();
    router.refresh();
  }

  return (
    <tr className="border-t border-neutral-100 bg-neutral-50/60">
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
        <Input
          form={formId}
          className={cellInputClass}
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          disabled={loading}
          aria-label="Rubro"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          form={formId}
          type="number"
          min={0}
          step="0.01"
          className={cn(cellInputClass, "min-w-[6rem]")}
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          required
          disabled={loading}
          aria-label="Precio base"
        />
      </td>
      {activeLists.map((l) => (
        <td key={l.id} className="px-3 py-2">
          <Input
            form={formId}
            type="number"
            min={0}
            step="0.01"
            className={cn(cellInputClass, "min-w-[6rem]")}
            value={listPrices[l.id] ?? ""}
            onChange={(e) =>
              setListPrices((prev) => ({ ...prev, [l.id]: e.target.value }))
            }
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
          title={
            allowsUnitOrder
              ? "Pedido por unidades o kg"
              : "Solo por kg"
          }
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
}: {
  product: ProductTableRow;
  activeLists: PriceListOption[];
  editDisabled: boolean;
  onStartEdit: () => void;
}) {
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-3 py-2 font-mono">{product.code}</td>
      <td className="px-3 py-2">{product.name}</td>
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
          {product.allowsUnitOrder ? "Unid. o kg" : "Solo kg"}
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
}: {
  products: ProductTableRow[];
  priceLists: PriceListOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const activeLists = priceLists.filter((l) => l.active);
  const isBusy = editingId !== null;

  return (
    <DataTableScroll>
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Rubro</th>
            <th className="px-3 py-2">Precio base</th>
            {activeLists.map((l) => (
              <th key={l.id} className="whitespace-nowrap px-3 py-2">
                {l.name}
              </th>
            ))}
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Pedido unid.</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {products.map((p) =>
            editingId === p.id ? (
              <ProductEditRow
                key={p.id}
                product={p}
                activeLists={activeLists}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ProductViewRow
                key={p.id}
                product={p}
                activeLists={activeLists}
                editDisabled={isBusy}
                onStartEdit={() => setEditingId(p.id)}
              />
            ),
          )}
          {products.length === 0 ? (
            <tr>
              <td
                colSpan={6 + activeLists.length}
                className="px-3 py-8 text-center text-neutral-500"
              >
                No hay productos
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </DataTableScroll>
  );
}
