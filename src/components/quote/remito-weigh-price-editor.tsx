"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatPrice } from "@/lib/utils";

type Props = {
  quoteId: string;
  itemId: string;
  initialQty: number;
  /** Stored remito line price (0 while pending weigh). */
  initialUnitPrice: number;
  /**
   * Catalog $/kg for this customer (list override → base) — same as kg order.
   * Prefills Precio $/kg when line still at $0.
   */
  suggestedKgPrice: number;
  /** Unit-count line: do not prefill qty (admin enters kg after weigh). */
  orderedByUnit: boolean;
};

function defaultPriceInput(
  initialUnitPrice: number,
  suggestedKgPrice: number,
): string {
  if (initialUnitPrice > 0) return String(initialUnitPrice);
  if (suggestedKgPrice > 0) return String(suggestedKgPrice);
  return "";
}

/**
 * Admin-only: confirm $/kg (+ optional kg) on unit-order remito lines at $0.
 * Flat under the row (no nested card chrome) — row amber bg is enough.
 */
export function RemitoWeighPriceEditor({
  quoteId,
  itemId,
  initialQty,
  initialUnitPrice,
  suggestedKgPrice,
  orderedByUnit,
}: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(
    orderedByUnit && initialUnitPrice === 0 ? "" : String(initialQty),
  );
  const [unitPrice, setUnitPrice] = useState(() =>
    defaultPriceInput(initialUnitPrice, suggestedKgPrice),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qtyNum = Number(String(qty).replace(",", "."));
  const priceNum = Number(String(unitPrice).replace(",", "."));
  const previewOk =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    Number.isFinite(priceNum) &&
    priceNum >= 0;
  const previewTotal = previewOk ? qtyNum * priceNum : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Ingresá el kg pesado (mayor a 0)");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Ingresá el precio por kg");
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

    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 print:hidden"
    >
      <p className="text-xs font-medium text-amber-950">
        Confirmar precio tras pesaje
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[5.5rem] flex-1 space-y-0.5">
          <span className="text-[11px] text-amber-900">Kg pesados</span>
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            placeholder={orderedByUnit ? "ej. 2.35" : undefined}
            className="h-8 font-mono text-sm"
            aria-label="Kg pesados"
            disabled={loading}
            autoFocus
          />
        </label>
        <label className="block min-w-[5.5rem] flex-1 space-y-0.5">
          <span className="text-[11px] text-amber-900">Precio $/kg</span>
          <Input
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            inputMode="decimal"
            placeholder={suggestedKgPrice > 0 ? undefined : "0.00"}
            className="h-8 font-mono text-sm"
            aria-label="Precio por kg"
            disabled={loading}
          />
        </label>
        <Button type="submit" size="sm" disabled={loading} className="shrink-0">
          {loading ? <Spinner className="h-4 w-4" /> : "Guardar"}
        </Button>
      </div>
      {previewTotal !== null ? (
        <p className="text-[11px] text-amber-900">
          Importe: {formatPrice(previewTotal)}
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </form>
  );
}
