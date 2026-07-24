"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataTableScroll } from "@/components/ui/data-table";
import { formatPrice } from "@/lib/utils";

type ItemRow = {
  productId: string;
  unitPrice: number;
  product: {
    code: string;
    name: string;
    rubro: string | null;
    basePrice: number;
    active: boolean;
  };
};

function pricesFromItems(items: ItemRow[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const i of items) {
    init[i.productId] = String(i.unitPrice);
  }
  return init;
}

export function PriceListEditor({
  priceList,
}: {
  priceList: {
    id: string;
    name: string;
    active: boolean;
    items: ItemRow[];
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(priceList.name);
  const [active, setActive] = useState(priceList.active);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    pricesFromItems(priceList.items),
  );
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [filling, setFilling] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return priceList.items;
    return priceList.items.filter(
      (i) =>
        i.product.code.toLowerCase().includes(q) ||
        i.product.name.toLowerCase().includes(q),
    );
  }, [filter, priceList.items]);

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setSavingMeta(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/price-lists/${priceList.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), active }),
    });
    setSavingMeta(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    setMessage("Lista actualizada");
    router.refresh();
  }

  async function savePrices() {
    setSavingPrices(true);
    setError(null);
    setMessage(null);
    const items = Object.entries(prices)
      .map(([productId, raw]) => ({
        productId,
        unitPrice: Number(String(raw).replace(",", ".")),
      }))
      .filter((i) => Number.isFinite(i.unitPrice) && i.unitPrice >= 0);

    if (items.length === 0) {
      setError("No hay precios para guardar");
      setSavingPrices(false);
      return;
    }

    const res = await fetch(`/api/admin/price-lists/${priceList.id}/items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setSavingPrices(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudieron guardar precios");
      return;
    }
    setMessage(`Precios guardados (${items.length})`);
    router.refresh();
  }

  async function fillFromBase() {
    if (
      !window.confirm(
        "¿Sobrescribir todos los precios de esta lista con el precio Mayorista (base)?",
      )
    ) {
      return;
    }
    setFilling(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/price-lists/${priceList.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fillFromBase" }),
    });
    setFilling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo rellenar");
      return;
    }
    setMessage("Lista rellenada desde Mayorista");
    router.refresh();
  }

  async function deleteList() {
    if (
      !window.confirm(
        "¿Eliminar esta lista? Los clientes asignados pasarán a Mayorista (base).",
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/price-lists/${priceList.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo eliminar");
      return;
    }
    router.push("/admin/listas-precios");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={saveMeta}
        className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="list-name">Nombre</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <label
            htmlFor="list-active"
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Switch
              id="list-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Activa
          </label>
          <Button type="submit" disabled={savingMeta}>
            {savingMeta ? "Guardando…" : "Guardar nombre"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void fillFromBase()}
          disabled={filling}
        >
          {filling ? "Rellenando…" : "Rellenar desde Mayorista"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void deleteList()}
        >
          Eliminar lista
        </Button>
        <Button
          type="button"
          onClick={() => void savePrices()}
          disabled={savingPrices}
        >
          {savingPrices ? "Guardando precios…" : "Guardar precios"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="space-y-2">
        <Input
          placeholder="Filtrar productos…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <DataTableScroll>
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">Precio lista</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.productId} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-mono">{i.product.code}</td>
                  <td className="px-3 py-2">
                    {i.product.name}
                    {!i.product.active ? (
                      <span className="ml-2 text-xs text-red-600">inactivo</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {formatPrice(i.product.basePrice)}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-9 w-28"
                      value={prices[i.productId] ?? ""}
                      onChange={(e) =>
                        setPrices((prev) => ({
                          ...prev,
                          [i.productId]: e.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableScroll>
        {priceList.items.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Sin precios. Usá “Rellenar desde Mayorista” o el seed Excel.
          </p>
        ) : null}
      </div>
    </div>
  );
}
