"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENTITY_ENABLED_FEMININE_LABELS } from "@/lib/entity-status-labels";
import { Switch } from "@/components/ui/switch";
import { DataTableScroll } from "@/components/ui/data-table";
import { formatArInput, formatPrice, parseArNumber } from "@/lib/utils";
import { filterFoldedSearch } from "@/lib/search-fold";
import {
  INCREMENTAL_REVEAL_INITIAL,
  INCREMENTAL_REVEAL_STEP,
  RevealMoreTableRow,
  useIncrementalReveal,
} from "@/hooks/use-incremental-reveal";

type ItemRow = {
  productId: string;
  unitPrice: number;
  product: {
    code: string;
    name: string;
    rubro: string | null;
    basePrice: number;
    available: boolean;
  };
};

function pricesFromItems(items: ItemRow[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const i of items) {
    init[i.productId] = formatArInput(i.unitPrice, 2, AR_PRICE_FORMAT);
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
    isBase?: boolean;
    items: ItemRow[];
  };
}) {
  const router = useRouter();
  const isBase = priceList.isBase === true;
  const [name, setName] = useState(priceList.name);
  const [active, setActive] = useState(priceList.active);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    pricesFromItems(priceList.items),
  );
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);

  const metaDirty =
    name.trim() !== priceList.name || active !== priceList.active;

  const pricesDirty = useMemo(() => {
    for (const item of priceList.items) {
      const raw = prices[item.productId] ?? "";
      const original = formatArInput(item.unitPrice, 2, AR_PRICE_FORMAT);
      if (raw !== original) return true;
    }
    return false;
  }, [prices, priceList.items]);

  const isDirty = metaDirty || pricesDirty;

  const filtered = useMemo(
    () =>
      filterFoldedSearch(priceList.items, filter, {
        primary: [(i) => i.product.code],
        secondary: [(i) => i.product.name],
        emptyReturnsAll: true,
      }),
    [filter, priceList.items],
  );

  const {
    visible,
    hasMore,
    revealMore,
    total,
  } = useIncrementalReveal(filtered, {
    initial: INCREMENTAL_REVEAL_INITIAL,
    step: INCREMENTAL_REVEAL_STEP,
    resetKey: filter,
  });

  const colSpan = isBase ? 3 : 4;

  async function saveChanges() {
    if (!isDirty || saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (metaDirty) {
        const trimmedName = name.trim();
        if (!trimmedName) {
          setError("El nombre es obligatorio");
          return;
        }

        const res = await fetch(`/api/admin/price-lists/${priceList.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName, active }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "No se pudo guardar la lista");
          return;
        }
      }

      if (pricesDirty) {
        const items = Object.entries(prices)
          .map(([productId, raw]) => ({
            productId,
            unitPrice: parseArNumber(String(raw)),
          }))
          .filter((i) => Number.isFinite(i.unitPrice) && i.unitPrice >= 0);

        if (items.length === 0) {
          setError("No hay precios válidos para guardar");
          return;
        }

        const res = await fetch(
          `/api/admin/price-lists/${priceList.id}/items`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "No se pudieron guardar precios");
          return;
        }
      }

      setMessage("Cambios guardados");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function fillFromBase() {
    if (isBase) return;
    if (
      !window.confirm(
        "¿Sobrescribir todos los precios de esta lista con el precio base?",
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
    setMessage("Lista rellenada desde precio base");
    router.refresh();
  }

  async function deleteList() {
    if (isBase) return;
    if (
      !window.confirm(
        "¿Eliminar esta lista? Los clientes asignados pasarán a Precio base.",
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
      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="list-name">Nombre</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="list-active" className="invisible select-none">
              {ENTITY_ENABLED_FEMININE_LABELS.enabled}
            </Label>
            <div className="flex h-10 items-center gap-2.5">
              <Switch
                id="list-active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <label
                htmlFor="list-active"
                className="cursor-pointer text-sm whitespace-nowrap text-neutral-700"
              >
                {ENTITY_ENABLED_FEMININE_LABELS.enabled}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {!isBase ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void fillFromBase()}
            disabled={filling || saving}
          >
            {filling ? "Rellenando…" : "Rellenar desde precio base"}
          </Button>
        ) : null}
        {!isBase ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => void deleteList()}
            disabled={saving}
            className="h-10 w-10 px-0"
            aria-label="Eliminar lista"
            title="Eliminar lista"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Filtrar productos…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <DataTableScroll className="data-table-rows-2l">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Producto</th>
                {!isBase ? (
                  <th className="px-3 py-2">Precio base</th>
                ) : null}
                <th className="px-3 py-2">
                  {isBase ? "Precio base" : "Precio lista"}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.productId} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-mono">{i.product.code}</td>
                  <td className="px-3 py-2">
                    <span className="admin-table-name-2l max-w-[18rem]">
                      {i.product.name}
                    </span>
                    {!i.product.available ? (
                      <span className="ml-2 text-xs text-red-600">
                        deshabilitado en catálogo
                      </span>
                    ) : null}
                  </td>
                  {!isBase ? (
                    <td className="px-3 py-2 text-neutral-600">
                      {formatPrice(i.product.basePrice)}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <ArNumberInput
                      className="h-9 w-28 font-mono"
                      value={prices[i.productId] ?? ""}
                      onValueChange={(raw) =>
                        setPrices((prev) => ({
                          ...prev,
                          [i.productId]: raw,
                        }))
                      }
                      maxFractionDigits={2}
                      formatOptions={AR_PRICE_FORMAT}
                      placeholder="0,00"
                    />
                  </td>
                </tr>
              ))}
              <RevealMoreTableRow
                colSpan={colSpan}
                enabled={hasMore}
                onReveal={revealMore}
                shown={visible.length}
                total={total}
              />
            </tbody>
          </table>
        </DataTableScroll>
        {priceList.items.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Sin precios. Usá “Rellenar desde precio base” o el seed Excel.
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          onClick={() => void saveChanges()}
          disabled={saving || !isDirty}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
