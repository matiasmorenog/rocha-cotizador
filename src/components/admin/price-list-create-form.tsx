"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function PriceListCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fillFromBase, setFillFromBase] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/price-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        fillFromBase,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear");
      return;
    }
    setName("");
    router.push(`/admin/listas-precios/${data.priceList.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="new-list-name">Nueva lista</Label>
          <Input
            id="new-list-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Lista 20% dto"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fill-from-base" className="text-neutral-500">
            Precios
          </Label>
          <div className="flex h-10 items-center gap-2.5">
            <Switch
              id="fill-from-base"
              checked={fillFromBase}
              onChange={(e) => setFillFromBase(e.target.checked)}
            />
            <label
              htmlFor="fill-from-base"
              className="cursor-pointer text-sm whitespace-nowrap text-neutral-700"
            >
              Rellenar desde precio base
            </label>
          </div>
        </div>
        <Button type="submit" className="shrink-0" disabled={loading || !name.trim()}>
          {loading ? "Creando…" : "Crear"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
