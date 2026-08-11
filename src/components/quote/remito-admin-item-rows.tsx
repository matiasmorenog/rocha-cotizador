"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { Spinner } from "@/components/ui/spinner";
import { TruncatedName } from "@/components/ui/truncated-name";
import { RemitoWeighPriceEditor } from "@/components/quote/remito-weigh-price-editor";
import { UNIT_ORDER_PRICE_WARNING } from "@/lib/unit-order-products";
import {
  useExitPresence,
  QUOTE_PICKER_FLOAT_MS,
} from "@/hooks/use-exit-presence";
import {
  cn,
  formatArInput,
  formatPrice,
  formatQty,
  parseArNumber,
} from "@/lib/utils";
import type { RowSelectionProps } from "@/hooks/use-selected-row";

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
  /** Pending $0 / orderByUnit — open weigh confirm editor + amber row. */
  needsWeighPrice: boolean;
  suggestedKgPrice: number;
  orderedByUnit: boolean;
  /** Total table columns including the actions column when chrome shown. */
  colSpan: number;
  /** Interactive edit — false while chrome is exiting. */
  editMode: boolean;
  /** Keep actions column / panels mounted through exit FLIP. */
  showEditChrome: boolean;
  /** Exit in progress — clip + non-interactive. */
  editExiting: boolean;
  rowProps?: RowSelectionProps;
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
  suggestedKgPrice,
  orderedByUnit,
  colSpan,
  editMode,
  showEditChrome,
  editExiting,
  rowProps,
}: RemitoAdminItemRowsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [qtyInput, setQtyInput] = useState(() => formatArInput(qty, 3));
  const [unitPriceInput, setUnitPriceInput] = useState(() =>
    formatArInput(unitPrice, 2, AR_PRICE_FORMAT),
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qtyNum = parseArNumber(qtyInput);
  const priceNum = parseArNumber(unitPriceInput);
  const previewOk =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    Number.isFinite(priceNum) &&
    priceNum >= 0;
  const previewTotal = previewOk ? qtyNum * priceNum : null;

  const showAmber = needsWeighPrice;
  /**
   * Panel open while edit chrome live and not globally exiting. Keep-mount via
   * useExitPresence so cancel / leave edit can play late-row exit (fade +
   * 0fr height) — same family as admin after-cutoff rows.
   */
  const wantPanel =
    showEditChrome && !editExiting && (needsWeighPrice || editing);
  const {
    present: showPanel,
    exiting: panelExiting,
    animKey: panelAnimKey,
  } = useExitPresence(wantPanel, QUOTE_PICKER_FLOAT_MS);
  const chromeInteractive = editMode && !editExiting && !panelExiting;

  const rowClass = cn(
    "border-b border-neutral-100",
    showAmber && "border-amber-100 bg-amber-50",
  );

  /** Match quote draft table: secondary + red hover on delete. */
  const iconBtnClass = "h-8 shrink-0 px-2";
  const deleteBtnClass =
    "h-8 shrink-0 px-2 hover:border-red-400 hover:bg-red-50 hover:text-red-700";

  function openEdit() {
    setQtyInput(formatArInput(qty, 3));
    setUnitPriceInput(formatArInput(unitPrice, 2, AR_PRICE_FORMAT));
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
      <tr
        {...rowProps}
        tabIndex={0}
        data-weigh-pending={showAmber ? "true" : undefined}
        className={cn("admin-table-row", rowClass)}
      >
        <td className="py-2 pl-2 pr-2 align-middle font-mono text-xs">
          {productCode}
        </td>
        <td className="py-2 pr-2 align-middle">
          {formatQty(qty)}{" "}
          <span className="text-neutral-500">{measureLabel}</span>
        </td>
        <td className="py-2 pr-2 align-middle">
          <TruncatedName
            name={productName}
            lines={needsWeighPrice ? 1 : 2}
            className="max-w-[16rem]"
          />
          {needsWeighPrice ? (
            <p className="mt-0.5 truncate text-xs text-amber-800">
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
        {showEditChrome ? (
          <td
            className={cn(
              "w-0 whitespace-nowrap py-2 pl-1 pr-2 align-middle print:hidden",
              editExiting && "overflow-hidden",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-end gap-1",
                editExiting && "remito-edit-chrome-exit pointer-events-none",
              )}
              aria-hidden={editExiting || undefined}
            >
              {needsWeighPrice || editing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || !canDelete || !chromeInteractive}
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
                    disabled={busy || !chromeInteractive}
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
                    disabled={busy || !canDelete || !chromeInteractive}
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
        ) : null}
      </tr>

      {showPanel ? (
        <tr
          key={panelAnimKey}
          className={cn(
            rowClass,
            "print:hidden",
            panelExiting
              ? "admin-late-row-exit pointer-events-none"
              : "admin-late-row-enter",
          )}
          data-weigh-pending={showAmber ? "true" : undefined}
          aria-hidden={panelExiting || undefined}
        >
          <td colSpan={colSpan} className="quote-draft-row-td">
            <div className="quote-draft-row-cell-shell">
              <div className="quote-draft-row-cell-clip">
                <div className="px-2 pb-3 pt-0">
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
                      className={cn(
                        "space-y-2",
                        showAmber &&
                          "rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2",
                      )}
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
                          <ArNumberInput
                            value={qtyInput}
                            onValueChange={setQtyInput}
                            maxFractionDigits={3}
                            className="h-8 font-mono text-sm"
                            aria-label="Cantidad"
                            disabled={busy || !chromeInteractive}
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
                          <ArNumberInput
                            value={unitPriceInput}
                            onValueChange={setUnitPriceInput}
                            maxFractionDigits={2}
                            formatOptions={AR_PRICE_FORMAT}
                            className="h-8 font-mono text-sm"
                            aria-label="Precio unitario"
                            disabled={busy || !chromeInteractive}
                          />
                        </label>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={busy || !chromeInteractive}
                          className="shrink-0"
                        >
                          {loading ? <Spinner className="h-4 w-4" /> : "Guardar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy || !chromeInteractive}
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
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : showEditChrome && !editExiting && error ? (
        <tr className={cn(rowClass, "print:hidden")}>
          <td colSpan={colSpan} className="px-2 pb-2 pt-0">
            <p className="text-xs text-red-700">{error}</p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
