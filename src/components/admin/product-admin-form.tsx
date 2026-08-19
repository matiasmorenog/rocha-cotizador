"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProductTipoField } from "@/components/admin/product-tipo-field";
import { notifyCatalogStale } from "@/lib/client-catalog-cache";
import { parseArNumber } from "@/lib/utils";

export type PriceListOption = {
  id: string;
  name: string;
  active: boolean;
};

/** Compact create-only form. Edits (incl. list prices) happen inline in ProductAdminTable. */
export function ProductAdminForm({
  rubros,
  onCancel,
}: {
  rubros: string[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rubro, setRubro] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [active, setActive] = useState(true);
  const [allowsUnitOrder, setAllowsUnitOrder] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const price = parseArNumber(basePrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Precio base inválido");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        rubro,
        basePrice: price,
        active,
        allowsUnitOrder,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    notifyCatalogStale();
    setMessage("Producto creado");
    setCode("");
    setName("");
    setRubro("");
    setBasePrice("");
    setActive(true);
    setAllowsUnitOrder(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <p className="text-sm font-medium text-neutral-800">Nuevo producto</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Código</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <ProductTipoField rubros={rubros} value={rubro} onChange={setRubro} />
        <div className="space-y-1">
          <Label>Precio base</Label>
          <ArNumberInput
            value={basePrice}
            onValueChange={setBasePrice}
            maxFractionDigits={2}
            formatOptions={AR_PRICE_FORMAT}
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <label
        htmlFor="product-active-create"
        className="flex cursor-pointer items-center gap-2.5 text-sm"
      >
        <Switch
          id="product-active-create"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Activo
      </label>
      <label
        htmlFor="product-unit-order-create"
        className="flex cursor-pointer items-center gap-2.5 text-sm"
      >
        <Switch
          id="product-unit-order-create"
          checked={allowsUnitOrder}
          onChange={(e) => setAllowsUnitOrder(e.target.checked)}
        />
        Permite pedido por unidades o kg (precio al pesar en unidades)
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
