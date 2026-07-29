"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DataTableScroll } from "@/components/ui/data-table";
import { UNIT_ORDER_PRICE_WARNING } from "@/lib/unit-order-products";
import {
  earliestDeliveryDateYmd,
  ORDER_CUTOFF_HOUR_AR,
} from "@/lib/delivery-date";
import {
  quoteLineMeasureLabel,
  quoteLineQtyAriaLabel,
} from "@/lib/order-measure";
import { cn, formatPrice } from "@/lib/utils";
import {
  effectiveLineTotal,
  effectiveUnitPrice,
  useQuoteDraftStore,
} from "@/stores/quote-draft-store";
import {
  ProductPicker,
  type CatalogSearchProduct,
} from "@/components/quote/product-picker";
import { QuoteDraftAnimatedRow } from "@/components/quote/quote-draft-animated-row";
import { QuoteDraftEmptyRow } from "@/components/quote/quote-draft-empty-row";
import { useAnimatedDraftLines } from "@/components/quote/use-animated-draft-lines";

type QuoteBuilderProps = {
  /** When set (admin flow), prices and submit use this customer. */
  customerId?: string;
};

export function QuoteBuilder({ customerId }: QuoteBuilderProps = {}) {
  const router = useRouter();
  const lines = useQuoteDraftStore((s) => s.lines);
  const addOrUpdate = useQuoteDraftStore((s) => s.addOrUpdate);
  const setQty = useQuoteDraftStore((s) => s.setQty);
  const setOrderByUnit = useQuoteDraftStore((s) => s.setOrderByUnit);
  const remove = useQuoteDraftStore((s) => s.remove);
  const clear = useQuoteDraftStore((s) => s.clear);
  const draftTotal = useQuoteDraftStore((s) => s.total());
  const { rows: animatedRows, emptyPhase, completeExit, completeEmptyExit } =
    useAnimatedDraftLines(lines);

  const [selected, setSelected] = useState<CatalogSearchProduct | null>(null);
  const [qty, setLocalQty] = useState("1");
  const [orderByUnit, setLocalOrderByUnit] = useState(false);
  const [notes, setNotes] = useState("");
  const [minDeliveryDate] = useState(() => earliestDeliveryDateYmd());
  const [deliveryDate, setDeliveryDate] = useState(() => earliestDeliveryDateYmd());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedAllowsUnit = selected?.allowsUnitOrder === true;
  const hasUnitOrderLines = lines.some((l) => l.orderByUnit);

  const onProductChange = useCallback((p: CatalogSearchProduct | null) => {
    setSelected(p);
    setLocalOrderByUnit(false);
    if (p) {
      queueMicrotask(() => {
        document.getElementById("qty")?.focus();
      });
    }
  }, []);

  function addLine() {
    if (!selected) return;
    const n = Number(qty.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Cantidad inválida");
      return;
    }
    const byUnit = selectedAllowsUnit && orderByUnit;
    addOrUpdate({
      productId: selected.id,
      code: selected.code,
      name: selected.name,
      unitPrice: selected.unitPrice,
      qty: n,
      orderByUnit: byUnit,
      allowsUnitOrder: selected.allowsUnitOrder,
    });
    setSelected(null);
    setLocalQty("1");
    setLocalOrderByUnit(false);
    setError(null);
    queueMicrotask(() => searchInputRef.current?.focus());
  }

  async function submitQuote() {
    if (lines.length === 0) {
      setError("Agregá al menos un producto");
      return;
    }
    if (!deliveryDate || deliveryDate < minDeliveryDate) {
      setError(
        `La fecha de entrega no puede ser anterior a ${minDeliveryDate}`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    const trimmedNotes = notes.trim();
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          orderByUnit: l.orderByUnit,
        })),
        deliveryDate,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        ...(customerId ? { customerId } : {}),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la cotización");
      return;
    }
    const data = await res.json();
    clear();
    setNotes("");
    setDeliveryDate(earliestDeliveryDateYmd());
    // Prefer remito + ?whatsapp=1 so a blocked popup still leaves a clear CTA.
    if (typeof data.whatsappUrl === "string" && data.whatsappUrl) {
      window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      router.push(`/remitos/${data.id}?whatsapp=1`);
      return;
    }
    router.push(`/remitos/${data.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div
          className={cn(
            "grid gap-3",
            selectedAllowsUnit
              ? "md:grid-cols-[1fr_minmax(0,auto)_auto]"
              : "md:grid-cols-[1fr_120px_auto]",
          )}
        >
          <ProductPicker
            customerId={customerId}
            value={selected}
            onChange={onProductChange}
            inputRef={searchInputRef}
          />
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[120px] min-w-[6rem] flex-1 sm:flex-none">
              <Label htmlFor="qty">Cantidad</Label>
              <Input
                id="qty"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setLocalQty(e.target.value)}
              />
            </div>
            {selectedAllowsUnit ? (
              <div className="flex min-w-[9rem] flex-1 items-end gap-3 sm:flex-none">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="order-mode">Medida</Label>
                  <select
                    id="order-mode"
                    value={orderByUnit ? "unit" : "kg"}
                    onChange={(e) =>
                      setLocalOrderByUnit(e.target.value === "unit")
                    }
                    className="flex h-10 w-full rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-9 text-sm focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1"
                  >
                    <option value="kg">Kg</option>
                    <option value="unit">Unidades</option>
                  </select>
                </div>
                {orderByUnit ? (
                  <span className="group relative mb-2 ml-0.5 inline-flex shrink-0">
                    <button
                      type="button"
                      className="inline-flex rounded text-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-1"
                      aria-describedby="unit-order-warning-tip"
                      aria-label={UNIT_ORDER_PRICE_WARNING}
                    >
                      <AlertTriangle className="h-5 w-5" aria-hidden />
                    </button>
                    <span
                      id="unit-order-warning-tip"
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-md bg-neutral-900 px-2.5 py-1.5 text-center text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {UNIT_ORDER_PRICE_WARNING}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={addLine} disabled={!selected}>
              Agregar
            </Button>
          </div>
        </div>
      </div>

      {hasUnitOrderLines ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {UNIT_ORDER_PRICE_WARNING}. Las líneas por unidades figuran con precio $0
          hasta el pesaje.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <DataTableScroll className="rounded-none border-0">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Cant.</th>
                <th className="px-3 py-2 font-medium">Medida</th>
                <th className="px-3 py-2 font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Importe</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {emptyPhase !== "hidden" ? (
                <QuoteDraftEmptyRow
                  exiting={emptyPhase === "exiting"}
                  onExitComplete={completeEmptyExit}
                />
              ) : null}
              {animatedRows.map(({ line: l, exiting, animateEnter }) => (
                <QuoteDraftAnimatedRow
                  key={l.id}
                  exiting={exiting}
                  animateEnter={animateEnter}
                  onExitComplete={() => completeExit(l.id)}
                  className={`border-t border-neutral-100 ${
                    l.orderByUnit ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-xs">{l.code}</td>
                  <td className="px-3 py-2">
                    <div>{l.name}</div>
                    {l.orderByUnit ? (
                      <p className="mt-0.5 text-xs text-amber-800">
                        {UNIT_ORDER_PRICE_WARNING}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-24"
                      type="number"
                      min={0.001}
                      step="any"
                      value={l.qty}
                      onChange={(e) => setQty(l.id, Number(e.target.value))}
                      aria-label={quoteLineQtyAriaLabel(
                        l.orderByUnit,
                        l.allowsUnitOrder,
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {l.allowsUnitOrder ? (
                      <select
                        value={l.orderByUnit ? "unit" : "kg"}
                        onChange={(e) =>
                          setOrderByUnit(l.id, e.target.value === "unit")
                        }
                        aria-label="Medida"
                        className="flex h-8 w-[7.5rem] rounded-md border border-neutral-300 bg-white pl-2 pr-8 text-xs focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1"
                      >
                        <option value="kg">Kg</option>
                        <option value="unit">Unidades</option>
                      </select>
                    ) : (
                      <span className="text-neutral-500">
                        {quoteLineMeasureLabel(
                          l.orderByUnit,
                          l.allowsUnitOrder,
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {formatPrice(effectiveUnitPrice(l))}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {formatPrice(effectiveLineTotal(l))}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="px-2 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
                      onClick={() => remove(l.id)}
                      aria-label="Quitar"
                      title="Quitar"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </td>
                </QuoteDraftAnimatedRow>
              ))}
            </tbody>
          </table>
        </DataTableScroll>
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm text-neutral-600">{lines.length} ítem(s)</p>
          <p className="text-lg font-semibold text-neutral-900">
            Total {formatPrice(draftTotal)}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="quote-delivery-date">Fecha de entrega</Label>
        <Input
          id="quote-delivery-date"
          type="date"
          value={deliveryDate}
          min={minDeliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          className="max-w-xs"
        />
        <p className="text-xs text-neutral-500">
          Pedidos antes de las {ORDER_CUTOFF_HOUR_AR}:00 (AR) se preparan para el
          día siguiente; después del corte, el mínimo es pasado mañana. Podés
          elegir una fecha más adelante.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="quote-notes">Observaciones</Label>
        <textarea
          id="quote-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional — aclaraciones del pedido (horario, detalle, etc.)"
          className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clear();
            setNotes("");
            setDeliveryDate(earliestDeliveryDateYmd());
          }}
          disabled={!lines.length && !notes.trim()}
        >
          Vaciar
        </Button>
        <Button type="button" onClick={submitQuote} disabled={submitting || !lines.length}>
          {submitting ? (
            <>
              <Spinner className="mr-2 text-white" />
              Enviando…
            </>
          ) : (
            "Confirmar cotización"
          )}
        </Button>
      </div>
    </div>
  );
}
