"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus, Trash2 } from "lucide-react";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { ProductPicker } from "@/components/quote/product-picker";
import type { CatalogSearchProduct } from "@/components/quote/product-picker";
import { Button } from "@/components/ui/button";
import { DataTableScroll } from "@/components/ui/data-table";
import { DatetimeLocalPicker } from "@/components/ui/datetime-local-picker";
import { Label } from "@/components/ui/label";
import { ArNumberValueInput } from "@/components/ui/ar-number-input";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import {
  coerceStockUnitForProduct,
  defaultStockUnitForProduct,
  stockUnitsForProduct,
  type ProductMeasureUnit,
} from "@/lib/stock-units";
import { cn } from "@/lib/utils";
import { toArgentinaDatetimeLocal } from "@/lib/argentina-time";
import { dispatchAdminStockSummaryRefresh } from "@/lib/admin-stock-summary-refresh";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import { productMatchesStockModule } from "@/lib/stock-rubros-shared";

export type StockRecountCustomer = {
  id: string;
  code: string;
  name: string;
};

type RecountLine = {
  productId: string;
  code: string;
  name: string;
  rubro: string | null;
  allowsUnitOrder: boolean;
  unit: ProductMeasureUnit;
  qty: number;
};

function todayYmdAr(): string {
  return toArgentinaDatetimeLocal(new Date()).slice(0, 10);
}

function ymdToPickerValue(ymd: string): string {
  return `${ymd}T00:00`;
}

function pickerValueToYmd(value: string): string {
  return value.slice(0, 10);
}

export function StockRecountForm({
  title,
  description,
  apiPath,
  customers,
  stockModule,
  fixedCustomerId,
  refreshAdminSummary = true,
  customerStockModule,
  open: openProp,
  onOpenChange,
}: {
  title: string;
  description: string;
  apiPath: string;
  customers: StockRecountCustomer[];
  stockModule: StockModuleKey;
  /** Hide branch picker — customer self-service stock. */
  fixedCustomerId?: string;
  /** Admin summary chart/cards refresh after save. */
  refreshAdminSummary?: boolean;
  /** Use customer stock product search API in the picker. */
  customerStockModule?: StockModuleKey;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(
    fixedCustomerId ?? customers[0]?.id ?? "",
  );
  const activeCustomerId = fixedCustomerId ?? customerId;
  const [dateValue, setDateValue] = useState(() =>
    ymdToPickerValue(todayYmdAr()),
  );
  const date = pickerValueToYmd(dateValue);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<RecountLine[]>([]);
  const [picked, setPicked] = useState<CatalogSearchProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCustomerId || !date) return;

    let cancelled = false;

    async function load() {
      setLoadingEntry(true);
      setError(null);
      setMessage(null);
      const params = new URLSearchParams({
        date,
        entryOnly: "1",
      });
      if (!fixedCustomerId) {
        params.set("customerId", activeCustomerId);
      }
      const res = await fetch(`${apiPath}?${params}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entry?: {
          notes: string | null;
          lines: Array<{
            productId: string;
            unit: string;
            qty: number;
            product: { code: string; name: string; rubro: string | null; allowsUnitOrder: boolean };
          }>;
        } | null;
      };
      if (cancelled) return;
      setLoadingEntry(false);
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar");
        return;
      }
      setNotes(data.entry?.notes ?? "");
      setLines(
        (data.entry?.lines ?? []).map((l) => ({
          productId: l.productId,
          code: l.product.code,
          name: l.product.name,
          rubro: l.product.rubro,
          allowsUnitOrder: l.product.allowsUnitOrder,
          unit: coerceStockUnitForProduct(l.unit, l.product.allowsUnitOrder),
          qty: l.qty,
        })),
      );
    }

    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });

    return () => {
      cancelled = true;
    };
  }, [apiPath, activeCustomerId, date, fixedCustomerId]);

  const sortedLines = useMemo(
    () =>
      [...lines].sort((a, b) => {
        const ra = (a.rubro ?? "").localeCompare(b.rubro ?? "", "es", {
          sensitivity: "base",
        });
        if (ra !== 0) return ra;
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      }),
    [lines],
  );

  const filterProduct = useCallback(
    (product: CatalogSearchProduct) =>
      productMatchesStockModule(
        product.rubro,
        stockModule,
        product.stockKind,
      ),
    [stockModule],
  );

  const moduleMismatchMessage =
    stockModule === "DESPERDICIOS"
      ? "Ese producto es insumo/consumible — cargalo en Consumibles"
      : stockModule === "CONSUMABLES"
        ? "Ese producto no es consumible — cargalo en Desperdicios o Activos"
        : "Ese producto no es un activo del local — revisá el tipo de stock del producto";

  function addProduct(product: CatalogSearchProduct) {
    if (!productMatchesStockModule(product.rubro, stockModule)) {
      setError(moduleMismatchMessage);
      return;
    }
    if (lines.some((l) => l.productId === product.id)) {
      setError("Ese producto ya está en la lista");
      return;
    }
    setError(null);
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        code: product.code,
        name: product.name,
        rubro: product.rubro,
        allowsUnitOrder: product.allowsUnitOrder === true,
        unit: defaultStockUnitForProduct(product.allowsUnitOrder === true),
        qty: 0,
      },
    ]);
    setPicked(null);
  }

  function updateLine(
    productId: string,
    patch: Partial<Pick<RecountLine, "qty" | "unit">>,
  ) {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeCustomerId) {
      setError("Elegí una sucursal / cliente");
      return;
    }
    const positive = lines.filter((l) => l.qty > 0);
    if (positive.length < 1) {
      setError("Ingresá al menos una cantidad mayor a 0");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: activeCustomerId,
        entryDate: date,
        notes,
        lines: positive.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unit: l.unit,
        })),
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    setMessage("Guardado");
    if (refreshAdminSummary) {
      dispatchAdminStockSummaryRefresh();
    }
    router.refresh();
  }

  const [openInternal, setOpenInternal] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (controlled) onOpenChange?.(v);
    else setOpenInternal(v);
  };
  const { present, exiting, animKey } = useExitPresence(open, 250);

  return (
    <div>
      <div
        className="grid transition-[grid-template-rows] duration-[250ms] ease-in"
        style={{ gridTemplateRows: present && !exiting ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          {present ? (
            <form
              key={animKey}
              onSubmit={onSubmit}
              className={cn(
                "space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm",
                exiting ? "payment-form-exit" : "payment-form-enter",
              )}
            >
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-600">{description}</p>
      </div>

      <div className={cn("grid gap-3", fixedCustomerId ? "" : "sm:grid-cols-2")}>
        {!fixedCustomerId ? (
          <div className="space-y-1">
            <Label>Sucursal / cliente</Label>
            <select
              className={cn(
                "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm",
                FOCUS_BRAND_BORDER,
              )}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              {customers.length === 0 ? (
                <option value="">Sin clientes con módulo</option>
              ) : (
                customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label>Fecha</Label>
          <DatetimeLocalPicker
            value={dateValue}
            onChange={setDateValue}
            aria-label="Fecha de carga"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Observaciones</Label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(
            "flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm",
            FOCUS_BRAND_BORDER,
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Agregar producto</Label>
        <ProductPicker
          value={picked}
          adminStockModule={customerStockModule ? undefined : stockModule}
          customerStockModule={customerStockModule}
          filterProduct={filterProduct}
          onChange={(p) => {
            if (p) addProduct(p);
            else setPicked(null);
          }}
        />
        <p className="text-xs text-neutral-500">
          {stockModule === "DESPERDICIOS"
            ? "Solo panes, masas y rubros de desperdicio (no insumos ni regalo)."
            : stockModule === "CONSUMABLES"
              ? "Solo insumos y regalo (gaseosas, etc.) — no son bajas del día."
              : "Solo productos marcados como activo del local (carritos, bandejas, etc.)."}
        </p>
      </div>

      {loadingEntry ? (
        <p className="text-sm text-neutral-500">Cargando carga del día…</p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Buscá productos y agregalos a la lista. Solo se guardan líneas con
          cantidad &gt; 0.
        </p>
      ) : (
        <DataTableScroll>
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2">Cantidad</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortedLines.map((l) => (
                <tr key={l.productId} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-neutral-500">
                      {l.code}
                    </span>{" "}
                    {l.name}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {l.rubro ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {l.allowsUnitOrder ? (
                      <select
                        className={cn(
                          "h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm",
                          FOCUS_BRAND_BORDER,
                        )}
                        value={l.unit}
                        onChange={(e) =>
                          updateLine(l.productId, {
                            unit: e.target.value as ProductMeasureUnit,
                          })
                        }
                        aria-label={`Unidad de ${l.name}`}
                      >
                        {stockUnitsForProduct(l.allowsUnitOrder).map((u) => (
                          <option key={u} value={u}>
                            {u === "kg" ? "Kg" : "Unidades"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-700">unid.</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ArNumberValueInput
                      value={l.qty}
                      onValueChange={(qty) => updateLine(l.productId, { qty })}
                      min={0}
                      className="w-28"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
                      aria-label="Quitar"
                      onClick={() => removeLine(l.productId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableScroll>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || customers.length === 0}>
          {saving ? "Guardando…" : "Guardar carga"}
        </Button>
      </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StockRecountTrigger({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button type="button" onClick={onClick}>
      <ClipboardPlus className="mr-1.5 h-4 w-4" aria-hidden />
      Registrar stock
    </Button>
  );
}
