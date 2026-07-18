"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ProductRow = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  basePrice: string | number;
  active: boolean;
};

export function ProductAdminForm({ product }: { product?: ProductRow }) {
  const router = useRouter();
  const [code, setCode] = useState(product?.code ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [rubro, setRubro] = useState(product?.rubro ?? "");
  const [basePrice, setBasePrice] = useState(String(product?.basePrice ?? ""));
  const [active, setActive] = useState(product?.active ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
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
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Código</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Precio base (mayorista)</Label>
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
