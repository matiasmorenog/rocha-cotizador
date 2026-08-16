"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArNumberValueInput } from "@/components/ui/ar-number-input";

type CatalogItem = {
  id: string;
  code: string;
  name: string;
  kind: string;
  unit: string;
};

type InitialEntry = {
  notes: string | null;
  lines: Array<{ stockItemId: string; qty: number }>;
} | null;

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildQtys(
  items: CatalogItem[],
  entry: InitialEntry,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const item of items) next[item.id] = 0;
  for (const line of entry?.lines ?? []) {
    next[line.stockItemId] = Number(line.qty) || 0;
  }
  return next;
}

export function StockCountForm({
  apiPath,
  title,
  emptyHint,
  items,
  initialDate,
  initialEntry,
}: {
  apiPath: string;
  title: string;
  emptyHint: string;
  items: CatalogItem[];
  initialDate: string;
  initialEntry: InitialEntry;
}) {
  const [date, setDate] = useState(initialDate || todayYmd());
  const [qtys, setQtys] = useState(() => buildQtys(items, initialEntry));
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingDate, setLoadingDate] = useState(false);

  const kindGroups = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    return [...map.entries()];
  }, [items]);

  async function onDateChange(nextDate: string) {
    setDate(nextDate);
    setLoadingDate(true);
    setError(null);
    setMessage(null);
    const res = await fetch(
      `${apiPath}?date=${encodeURIComponent(nextDate)}&entryOnly=1`,
    );
    const data = await res.json().catch(() => ({}));
    setLoadingDate(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo cargar");
      return;
    }
    setQtys(buildQtys(items, data.entry ?? null));
    setNotes(data.entry?.notes ?? "");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const lines = items.map((item) => ({
      stockItemId: item.id,
      qty: qtys[item.id] ?? 0,
    }));
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryDate: date, notes, lines }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    setMessage("Guardado");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        <p className="text-sm text-neutral-600">{emptyHint}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => void onDateChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Notas (opcional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No hay ítems activos en el catálogo. Pedile al admin que cargue el
          listado.
        </p>
      ) : (
        kindGroups.map(([kind, group]) => (
          <section key={kind} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {kind === "RAW_MATERIAL"
                ? "Materia prima"
                : kind === "BREAD"
                  ? "Pan"
                  : "Ítems"}
            </h2>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {group.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {item.code} · {item.unit}
                    </p>
                  </div>
                  <div className="w-28">
                    <ArNumberValueInput
                      value={qtys[item.id] ?? 0}
                      onValueChange={(v) =>
                        setQtys((prev) => ({ ...prev, [item.id]: v }))
                      }
                      min={0}
                      disabled={loadingDate}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Button
        type="submit"
        disabled={saving || loadingDate || items.length === 0}
      >
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
