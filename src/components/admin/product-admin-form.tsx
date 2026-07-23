"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type PriceListOption = {
  id: string;
  name: string;
  active: boolean;
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  basePrice: string | number;
  active: boolean;
  /** priceListId → unitPrice */
  listPrices?: Record<string, number>;
};

export function ProductAdminForm({
  product,
  priceLists,
}: {
  product?: ProductRow;
  priceLists: PriceListOption[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(product?.code ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [rubro, setRubro] = useState(product?.rubro ?? "");
  const [basePrice, setBasePrice] = useState(String(product?.basePrice ?? ""));
  const [listPrices, setListPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of priceLists) {
      const v = product?.listPrices?.[l.id];
      init[l.id] = v != null ? String(v) : "";
    }
    return init;
  });
  const [active, setActive] = useState(product?.active ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setListPrice(listId: string, value: string) {
    setListPrices((prev) => ({ ...prev, [listId]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const listPricePayload = priceLists.map((l) => {
      const raw = (listPrices[l.id] ?? "").trim();
      if (!raw) {
        return { priceListId: l.id, unitPrice: null as number | null };
      }
      return {
        priceListId: l.id,
        unitPrice: Number(raw.replace(",", ".")),
      };
    });

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

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product?.id,
        code,
        name,
        rubro,
        basePrice: Number(basePrice),
        active,
        listPrices: listPricePayload,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    setMessage("Guardado");
    if (!product) {
      setCode("");
      setName("");
      setRubro("");
      setBasePrice("");
      setListPrices(
        Object.fromEntries(priceLists.map((l) => [l.id, ""])) as Record<
          string,
          string
        >,
      );
    }
    router.refresh();
  }

  const listsForForm = priceLists.filter((l) => l.active || listPrices[l.id]);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Código</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Mayorista (base)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Rubro</Label>
          <Input value={rubro} onChange={(e) => setRubro(e.target.value)} />
        </div>
      </div>

      {listsForForm.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Precios por lista
          </p>
          <p className="text-xs text-neutral-500">
            Vacío = sin precio en esa lista (usa Mayorista como fallback).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {listsForForm.map((l) => (
              <div key={l.id} className="space-y-1">
                <Label>
                  {l.name}
                  {!l.active ? " (inactiva)" : ""}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={listPrices[l.id] ?? ""}
                  onChange={(e) => setListPrice(l.id, e.target.value)}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <label
        htmlFor="product-active"
        className="flex cursor-pointer items-center gap-2.5 text-sm"
      >
        <Switch
          id="product-active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Activo
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : product ? "Actualizar" : "Crear producto"}
      </Button>
    </form>
  );
}
