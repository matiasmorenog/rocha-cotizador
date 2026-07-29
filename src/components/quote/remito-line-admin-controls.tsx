"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RemitoWeighPriceEditor } from "@/components/quote/remito-weigh-price-editor";
import { formatPrice } from "@/lib/utils";

type Props = {
  quoteId: string;
  itemId: string;
  initialQty: number;
  initialUnitPrice: number;
  measureLabel: string;
  /**
   * Remito must keep ≥1 line (API + UI). False when this is the only item.
   */
  canDelete: boolean;
  needsWeighPrice: boolean;
  suggestedKgPrice: number;
  orderedByUnit: boolean;
};

/**
 * Admin-only remito line controls: weigh confirm (pending $0), edit qty/price, delete.
 * Weigh-pending lines open the kg/$ editor by default (no Editar click).
 */
export function RemitoLineAdminControls({
  quoteId,
  itemId,
  initialQty,
  initialUnitPrice,
  measureLabel,
  canDelete,
  needsWeighPrice,
  suggestedKgPrice,
  orderedByUnit,
}: Props) {
  const router = useRouter();
  // Non-weigh lines start collapsed; weigh lines use RemitoWeighPriceEditor instead.
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(initialQty));
  const [unitPrice, setUnitPrice] = useState(String(initialUnitPrice));
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qtyNum = Number(String(qty).replace(",", "."));
  const priceNum = Number(String(unitPrice).replace(",", "."));
  const previewOk =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    Number.isFinite(priceNum) &&
    priceNum >= 0;
  const previewTotal = previewOk ? qtyNum * priceNum : null;

  function openEdit() {
    setQty(String(initialQty));
    setUnitPrice(String(initialUnitPrice));
    setError(null);
    setEditing(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Cantidad debe ser mayor a 0");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Precio inválido");
      return;
    }

    setLoading(true);
    const res = await fetch(
      `/api/admin/quotes/${quoteId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: qtyNum, unitPrice: priceNum }),
      },
    );
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        typeof data.error === "string" ? data.error : "No se pudo guardar",
      );
      return;
    }

    setEditing(false);
    router.refresh();
  }

  async function onDelete() {
    if (!canDelete) {
      setError(
        "No se puede eliminar la única línea del remito. Corregí cantidad o precio.",
      );
      return;
    }
    if (
      !window.confirm(
        "¿Eliminar esta línea del remito? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);
    const res = await fetch(
      `/api/admin/quotes/${quoteId}/items/${itemId}`,
      { method: "DELETE" },
    );
    setDeleting(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        typeof data.error === "string" ? data.error : "No se pudo eliminar",
      );
      return;
    }

    router.refresh();
  }

  const busy = loading || deleting;
  const deleteTitle = canDelete
    ? "Eliminar línea"
    : "No se puede eliminar la única línea del remito";

  return (
    <div className="mt-2 space-y-2 print:hidden">
      {needsWeighPrice ? (
        <RemitoWeighPriceEditor
          quoteId={quoteId}
          itemId={itemId}
          initialQty={initialQty}
          initialUnitPrice={initialUnitPrice}
          suggestedKgPrice={suggestedKgPrice}
          orderedByUnit={orderedByUnit}
        />
      ) : null}

      {needsWeighPrice ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy || !canDelete}
            className="h-8 w-8 px-0"
            aria-label={deleteTitle}
            title={deleteTitle}
            onClick={onDelete}
          >
            {deleting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      ) : editing ? (
        <form
          onSubmit={onSave}
          className="space-y-2 rounded-md border border-neutral-300 bg-neutral-50 p-2"
        >
          <p className="text-xs font-medium text-neutral-800">Editar línea</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[5.5rem] flex-1 space-y-0.5">
              <span className="text-[11px] text-neutral-600">
                Cantidad ({measureLabel})
              </span>
              <Input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                className="h-8 font-mono text-sm"
                aria-label="Cantidad"
                disabled={busy}
              />
            </label>
            <label className="block min-w-[5.5rem] flex-1 space-y-0.5">
              <span className="text-[11px] text-neutral-600">Precio unitario</span>
              <Input
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                inputMode="decimal"
                className="h-8 font-mono text-sm"
                aria-label="Precio unitario"
                disabled={busy}
              />
            </label>
            <Button type="submit" size="sm" disabled={busy} className="shrink-0">
              {loading ? <Spinner className="h-4 w-4" /> : "Guardar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="shrink-0"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
          {previewTotal !== null ? (
            <p className="text-[11px] text-neutral-600">
              Importe: {formatPrice(previewTotal)}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-8 w-8 px-0"
            aria-label="Editar línea"
            title="Editar línea"
            onClick={openEdit}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy || !canDelete}
            className="h-8 w-8 px-0"
            aria-label={deleteTitle}
            title={deleteTitle}
            onClick={onDelete}
          >
            {deleting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      )}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
