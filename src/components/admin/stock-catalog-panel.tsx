"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AdminProductPicker,
  type PickedProduct,
} from "@/components/admin/admin-product-picker";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import {
  DEFAULT_STOCK_UNIT,
  STOCK_UNITS,
  coerceStockUnit,
  type StockUnit,
} from "@/lib/stock-units";
import { cn } from "@/lib/utils";

type StockItem = {
  id: string;
  productId: string;
  code: string;
  name: string;
  rubro: string | null;
  unit: string;
  active: boolean;
  sortOrder: number;
};

export function StockCatalogPanel({
  items: initial,
  rubros: rubrosProp,
}: {
  items: StockItem[];
  /** Tipo options — kept in memory for this mount; no client refetch. */
  rubros: string[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [rubros] = useState(rubrosProp);
  const [rubroFilter, setRubroFilter] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (rubroFilter === "ALL") return items;
    return items.filter(
      (i) =>
        (i.rubro ?? "").trim().toLowerCase() === rubroFilter.toLowerCase(),
    );
  }, [items, rubroFilter]);

  const editing = items.find((i) => i.id === editingId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          className={cn(
            "h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm",
            FOCUS_BRAND_BORDER,
          )}
          value={rubroFilter}
          onChange={(e) => setRubroFilter(e.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="ALL">Todos los tipos</option>
          {rubros.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
        >
          Agregar producto
        </Button>
      </div>

      {creating || editing ? (
        <StockItemForm
          key={editing?.id ?? "new"}
          item={editing}
          rubros={rubros}
          defaultRubro={rubroFilter === "ALL" ? "" : rubroFilter}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSaved={(saved) => {
            setItems((prev) => {
              const idx = prev.findIndex((i) => i.id === saved.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [saved, ...prev];
            });
            setCreating(false);
            setEditingId(null);
            router.refresh();
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Unidad</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-neutral-500"
                >
                  Sin productos en el catálogo de stock. Agregá desde el listado
                  de productos.
                </td>
              </tr>
            ) : (
              filtered.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-xs">{i.code}</td>
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2">{i.rubro ?? "—"}</td>
                  <td className="px-3 py-2">{i.unit}</td>
                  <td className="px-3 py-2">
                    {i.active ? "Activo" : "Inactivo"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-[var(--brand-primary)] hover:underline"
                      onClick={() => {
                        setCreating(false);
                        setEditingId(i.id);
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockItemForm({
  item,
  rubros,
  defaultRubro,
  onCancel,
  onSaved,
}: {
  item?: StockItem;
  rubros: string[];
  defaultRubro: string;
  onCancel: () => void;
  onSaved: (item: StockItem) => void;
}) {
  const [tipo, setTipo] = useState(
    item?.rubro ?? defaultRubro ?? rubros[0] ?? "",
  );
  const [product, setProduct] = useState<PickedProduct | null>(
    item
      ? {
          id: item.productId,
          code: item.code,
          name: item.name,
          rubro: item.rubro,
        }
      : null,
  );
  const [unit, setUnit] = useState<StockUnit>(
    coerceStockUnit(item?.unit ?? DEFAULT_STOCK_UNIT),
  );
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onTipoChange(next: string) {
    setTipo(next);
    if (product && (product.rubro ?? "") !== next) {
      setProduct(null);
    }
  }

  function onProductChange(p: PickedProduct | null) {
    setProduct(p);
    if (p?.rubro) setTipo(p.rubro);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) {
      setError("Elegí un producto del catálogo");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/stock-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item?.id,
        productId: product.id,
        unit,
        active,
        sortOrder: Number(sortOrder) || 0,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    onSaved(data.item as StockItem);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-neutral-800">
        {item ? "Editar membresía de stock" : "Agregar producto al stock"}
      </p>
      <div className="space-y-1">
        <Label>Tipo</Label>
        <select
          className={cn(
            "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm",
            FOCUS_BRAND_BORDER,
          )}
          value={tipo}
          onChange={(e) => onTipoChange(e.target.value)}
          disabled={Boolean(item)}
          required={!item}
        >
          <option value="" disabled>
            Elegí un tipo…
          </option>
          {rubros.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-500">
          Tipos = valores únicos de la columna tipo/rubro del catálogo de
          productos.
        </p>
      </div>
      <AdminProductPicker
        value={product}
        onChange={onProductChange}
        disabled={Boolean(item)}
        rubroFilter={item ? null : tipo || null}
      />
      {item ? (
        <p className="text-xs text-neutral-500">
          El producto no se cambia al editar. Para otro SKU, creá una membresía
          nueva.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Unidad</Label>
          <select
            className={cn(
              "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm",
              FOCUS_BRAND_BORDER,
            )}
            value={unit}
            onChange={(e) => setUnit(e.target.value as StockUnit)}
            required
          >
            {STOCK_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Orden</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            title="Menor número aparece primero dentro del mismo tipo"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
        <p className="text-sm font-medium text-neutral-800">Activo</p>
        <Switch
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
