"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";
import type { StockItemKind } from "@prisma/client";

type StockItem = {
  id: string;
  code: string;
  name: string;
  kind: StockItemKind;
  unit: string;
  active: boolean;
  sortOrder: number;
};

const KIND_LABELS: Record<StockItemKind, string> = {
  RAW_MATERIAL: "Materia prima",
  BREAD: "Pan",
  CONSUMABLE: "Consumible",
};

const KINDS: StockItemKind[] = ["RAW_MATERIAL", "BREAD", "CONSUMABLE"];

export function StockCatalogPanel({ items: initial }: { items: StockItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [kindFilter, setKindFilter] = useState<StockItemKind | "ALL">("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      kindFilter === "ALL"
        ? items
        : items.filter((i) => i.kind === kindFilter),
    [items, kindFilter],
  );

  const editing = items.find((i) => i.id === editingId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          className={cn(
            "h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm",
            FOCUS_BRAND_BORDER,
          )}
          value={kindFilter}
          onChange={(e) =>
            setKindFilter(e.target.value as StockItemKind | "ALL")
          }
        >
          <option value="ALL">Todos</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
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
          Nuevo ítem
        </Button>
      </div>

      {creating || editing ? (
        <StockItemForm
          key={editing?.id ?? "new"}
          item={editing}
          defaultKind={kindFilter === "ALL" ? "BREAD" : kindFilter}
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
            {filtered.map((i) => (
              <tr key={i.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{i.code}</td>
                <td className="px-3 py-2">{i.name}</td>
                <td className="px-3 py-2">{KIND_LABELS[i.kind]}</td>
                <td className="px-3 py-2">{i.unit}</td>
                <td className="px-3 py-2">{i.active ? "Activo" : "Inactivo"}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockItemForm({
  item,
  defaultKind,
  onCancel,
  onSaved,
}: {
  item?: StockItem;
  defaultKind: StockItemKind;
  onCancel: () => void;
  onSaved: (item: StockItem) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [kind, setKind] = useState<StockItemKind>(item?.kind ?? defaultKind);
  const [unit, setUnit] = useState(item?.unit ?? "unid.");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/stock-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item?.id,
        code,
        name,
        kind,
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
        {item ? "Editar ítem" : "Nuevo ítem"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Código</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <select
            className={cn(
              "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm",
              FOCUS_BRAND_BORDER,
            )}
            value={kind}
            onChange={(e) => setKind(e.target.value as StockItemKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Unidad</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Orden</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
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
