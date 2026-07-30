"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RemitoWeighPriceEditor } from "@/components/quote/remito-weigh-price-editor";
import { UNIT_ORDER_PRICE_WARNING } from "@/lib/unit-order-products";
import { formatPrice, formatQty } from "@/lib/utils";

export type RemitoAdminItemRowsProps = {
  quoteId: string;
  itemId: string;
  productCode: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  measureLabel: string;
  canDelete: boolean;
  /** Pending $0 / orderByUnit — open weigh confirm editor. */
  needsWeighPrice: boolean;
  /**
   * Product allows unit/kg weigh confirm. Amber row + panels even after
   * price already confirmed.
   */
  isWeighConfirmProduct: boolean;
  suggestedKgPrice: number;
  orderedByUnit: boolean;
  /** Total table columns including the actions column. */
  colSpan: number;
};

/**
 * Admin remito line: data cells + icon actions column; weigh/edit panel on
 * a second print-hidden row so Precio/Importe stay aligned.
 */
export function RemitoAdminItemRows({
  quoteId,
  itemId,
  productCode,
  productName,
  qty,
  unitPrice,
  lineTotal,
  measureLabel,
  canDelete,
  needsWeighPrice,
  isWeighConfirmProduct,
  suggestedKgPrice,
  orderedByUnit,
  colSpan,
}: RemitoAdminItemRowsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(qty));
  const [unitPriceInput, setUnitPriceInput] = useState(String(unitPrice));
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qtyNum = Number(String(qtyInput).replace(",", "."));
  const priceNum = Number(String(unitPriceInput).replace(",", "."));
  const previewOk =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    Number.isFinite(priceNum) &&
    priceNum >= 0;
  const previewTotal = previewOk ? qtyNum * priceNum : null;

  const showAmber = needsWeighPrice || isWeighConfirmProduct;
  const showPanel = needsWeighPrice || editing;

  const rowClass = showAmber
    ? "border-b border-amber-200 bg-amber-50"
    : "border-b border-neutral-100";

  /** Match quote draft table: secondary + red hover on delete. */
  const iconBtnClass = "h-8 shrink-0 px-2";
  const deleteBtnClass =
    "h-8 shrink-0 px-2 hover:border-red-400 hover:bg-red-50 hover:text-red-700";

  function openEdit() {
    setQtyInput(String(qty));
    setUnitPriceInput(String(unitPrice));
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
    <>
      <tr className={rowClass}>
        <td className="py-2 pl-2 pr-2 align-middle font-mono text-xs">
          {productCode}
        </td>
        <td className="py-2 pr-2 align-middle">
          {formatQty(qty)}{" "}
          <span className="text-neutral-500">{measureLabel}</span>
        </td>
        <td className="py-2 pr-2 align-middle">
          <div>{productName}</div>
          {needsWeighPrice ? (
            <p className="mt-0.5 text-xs text-amber-800">
              {UNIT_ORDER_PRICE_WARNING}
            </p>
          ) : null}
        </td>
        <td className="py-2 pr-2 text-right align-middle">
          {formatPrice(unitPrice)}
        </td>
        <td className="py-2 pr-2 text-right align-middle font-medium">
          {formatPrice(lineTotal)}
        </td>
        <td className="w-0 whitespace-nowrap py-2 pl-1 pr-2 align-middle print:hidden">
          <div className="flex items-center justify-end gap-1">
            {needsWeighPrice || editing ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !canDelete}
                className={deleteBtnClass}
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
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  className={iconBtnClass}
                  aria-label="Editar línea"
                  title="Editar línea"
                  onClick={openEdit}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || !canDelete}
                  className={deleteBtnClass}
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
              </>
            )}
          </div>
        </td>
      </tr>

      {showPanel ? (
        <tr className={`${rowClass} print:hidden`}>
          <td colSpan={colSpan} className="px-2 pb-3 pt-0">
            {needsWeighPrice ? (
              <RemitoWeighPriceEditor
                quoteId={quoteId}
                itemId={itemId}
                initialQty={qty}
                initialUnitPrice={unitPrice}
                suggestedKgPrice={suggestedKgPrice}
                orderedByUnit={orderedByUnit}
              />
            ) : (
              <form
                onSubmit={onSave}
                className={
                  showAmber
                    ? "space-y-2 rounded-md border border-amber-300 bg-amber-50/80 p-2"
                    : "space-y-2 rounded-md border border-neutral-300 bg-neutral-50 p-2"
                }
              >
                <p
                  className={
                    showAmber
                      ? "text-xs font-medium text-amber-950"
                      : "text-xs font-medium text-neutral-800"
                  }
                >
                  Editar línea
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block min-w-[5.5rem] flex-1 space-y-0.5">
                    <span
                      className={
                        showAmber
                          ? "text-[11px] text-amber-900"
                          : "text-[11px] text-neutral-600"
                      }
                    >
                      Cantidad ({measureLabel})
                    </span>
                    <Input
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      inputMode="decimal"
                      className="h-8 font-mono text-sm"
                      aria-label="Cantidad"
                      disabled={busy}
                    />
                  </label>
                  <label className="block min-w-[5.5rem] flex-1 space-y-0.5">
                    <span
                      className={
                        showAmber
                          ? "text-[11px] text-amber-900"
                          : "text-[11px] text-neutral-600"
                      }
                    >
                      Precio unitario
                    </span>
                    <Input
                      value={unitPriceInput}
                      onChange={(e) => setUnitPriceInput(e.target.value)}
                      inputMode="decimal"
                      className="h-8 font-mono text-sm"
                      aria-label="Precio unitario"
                      disabled={busy}
                    />
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy}
                    className="shrink-0"
                  >
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
                  <p
                    className={
                      showAmber
                        ? "text-[11px] text-amber-900"
                        : "text-[11px] text-neutral-600"
                    }
                  >
                    Importe: {formatPrice(previewTotal)}
                  </p>
                ) : null}
              </form>
            )}
            {error ? (
              <p className="mt-1 text-xs text-red-700">{error}</p>
            ) : null}
          </td>
        </tr>
      ) : error ? (
        <tr className={`${rowClass} print:hidden`}>
          <td colSpan={colSpan} className="px-2 pb-2 pt-0">
            <p className="text-xs text-red-700">{error}</p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
