"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { FormSection } from "@/components/admin/form-section";
import { FormToggleCard } from "@/components/admin/form-toggle-card";
import { ProductStockKindPicker } from "@/components/admin/product-stock-kind-picker";
import { ProductTipoField } from "@/components/admin/product-tipo-field";
import {
  AdminDraftModal,
  AdminDraftModalBody,
  AdminDraftModalFooter,
  AdminDraftModalHeader,
} from "@/components/ui/admin-draft-modal";
import { Button } from "@/components/ui/button";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDraftSession } from "@/hooks/use-draft-session";
import type { DraftSessionInfo } from "@/hooks/use-draft-session";
import { notifyCatalogStale } from "@/lib/client-catalog-cache";
import { CATALOG_PRODUCT_ENABLED_LABEL } from "@/lib/entity-status-labels";
import { dispatchAdminInAppToast } from "@/lib/push-sw-client";
import { DEFAULT_PRODUCT_STOCK_KIND } from "@/lib/stock-product-kind-labels";
import {
  productSupportsUnitOrKgOrder,
  type ProductStockKindValue,
} from "@/lib/stock-product-kind-shared";
import { inferStockKindFromRubro } from "@/lib/stock-rubros-shared";
import { parseArNumber } from "@/lib/utils";

export type PriceListOption = {
  id: string;
  name: string;
  active: boolean;
};

const TITLE_ID = "product-create-title";

/** Create-only form in draft modal. Edits stay inline in ProductAdminTable. */
export function ProductAdminForm({
  rubros,
  open,
  onOpenChange,
  onDraftChange,
}: {
  rubros: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange?: (draft: DraftSessionInfo) => void;
}) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rubro, setRubro] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [stockKind, setStockKind] =
    useState<ProductStockKindValue>(DEFAULT_PRODUCT_STOCK_KIND);
  const [allowsUnitOrder, setAllowsUnitOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dirtyCount = useMemo(() => {
    let n = 0;
    if (code.trim()) n += 1;
    if (name.trim()) n += 1;
    if (rubro.trim()) n += 1;
    if (basePrice.trim()) n += 1;
    return n;
  }, [code, name, rubro, basePrice]);

  const {
    open: modalOpen,
    setOpen,
    minimize,
    endSession,
    showShell,
    showChip,
    exiting,
    animKey,
  } = useDraftSession({
    open,
    onOpenChange,
    itemCount: dirtyCount,
    onDraftChange,
  });

  function resetFields() {
    setCode("");
    setName("");
    setRubro("");
    setBasePrice("");
    setAvailable(true);
    setStockKind(DEFAULT_PRODUCT_STOCK_KIND);
    setAllowsUnitOrder(false);
    setError(null);
    setFormKey((k) => k + 1);
  }

  function discardDraft() {
    resetFields();
    endSession();
  }

  function onRubroChange(nextRubro: string) {
    setRubro(nextRubro);
    const nextKind = inferStockKindFromRubro(nextRubro);
    setStockKind(nextKind);
    if (!productSupportsUnitOrKgOrder(nextKind)) {
      setAllowsUnitOrder(false);
    }
  }

  function onStockKindChange(nextKind: ProductStockKindValue) {
    setStockKind(nextKind);
    if (!productSupportsUnitOrKgOrder(nextKind)) {
      setAllowsUnitOrder(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const price = parseArNumber(basePrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Precio base inválido");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          rubro,
          basePrice: price,
          available,
          stockKind,
          allowsUnitOrder: productSupportsUnitOrKgOrder(stockKind)
            ? allowsUnitOrder
            : false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `No se pudo guardar el producto (HTTP ${res.status}).`;
        setError(detail);
        dispatchAdminInAppToast({
          title: "Error al guardar producto",
          body: detail,
          tone: "error",
        });
        return;
      }

      const savedLabel = `${name.trim()} (${code.trim()})`;
      dispatchAdminInAppToast({
        title: "Producto creado",
        body: savedLabel,
        tone: "success",
      });
      notifyCatalogStale();
      resetFields();
      endSession();
      router.refresh();
    } catch {
      const detail = "No se pudo conectar con el servidor. Revisá tu conexión.";
      setError(detail);
      dispatchAdminInAppToast({
        title: "Error al guardar producto",
        body: detail,
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const chipSubtitle = name.trim()
    ? name.trim()
    : code.trim()
      ? code.trim()
      : dirtyCount > 0
        ? `${dirtyCount} campo${dirtyCount === 1 ? "" : "s"}`
        : "Sin datos aún";

  return (
    <AdminDraftModal
      open={modalOpen}
      showShell={showShell}
      showChip={showChip}
      exiting={exiting}
      animKey={animKey}
      labelledBy={TITLE_ID}
      onMinimize={minimize}
      onResume={() => setOpen(true)}
      maxWidthClassName="max-w-2xl"
      chip={{
        title: "Producto en curso",
        subtitle: chipSubtitle,
        icon: PackagePlus,
      }}
    >
      <form
        key={formKey}
        onSubmit={onSubmit}
        className="flex max-h-[min(90vh,52rem)] flex-col"
      >
        <AdminDraftModalHeader
          titleId={TITLE_ID}
          title="Nuevo producto"
          description="Alta de catálogo. Los precios de listas se editan después en la fila."
        />
        <AdminDraftModalBody>
          <FormSection
            title="Identificación"
            description="Código, nombre y rubro del producto en el catálogo."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="product-code">Código</Label>
                <Input
                  id="product-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-name">Nombre</Label>
                <Input
                  id="product-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <ProductTipoField
                rubros={rubros}
                value={rubro}
                onChange={onRubroChange}
              />
            </div>
          </FormSection>

          <FormSection
            title="Precio base"
            description="Precio de la lista base; las demás listas pueden tener valores distintos."
          >
            <div className="max-w-xs space-y-1">
              <Label htmlFor="product-base-price">Precio base</Label>
              <ArNumberInput
                id="product-base-price"
                value={basePrice}
                onValueChange={setBasePrice}
                maxFractionDigits={2}
                formatOptions={AR_PRICE_FORMAT}
                placeholder="0,00"
                required
              />
            </div>
          </FormSection>

          <FormSection
            title="Tipo de stock"
            description="Define en qué módulo de stock aparece al recuentar (desperdicios, consumibles o activos)."
          >
            <ProductStockKindPicker
              value={stockKind}
              onChange={onStockKindChange}
            />
          </FormSection>

          <FormSection
            title="Opciones"
            description="Disponibilidad en cotizaciones y reglas de pedido."
            className="space-y-3"
          >
            <FormToggleCard
              id="product-available-create"
              label={CATALOG_PRODUCT_ENABLED_LABEL}
              description="Si está deshabilitado, no aparece en cotizaciones ni listas de clientes."
              checked={available}
              onChange={setAvailable}
            />
            {productSupportsUnitOrKgOrder(stockKind) ? (
              <FormToggleCard
                id="product-unit-order-create"
                label="Pedido por unidades o kg"
                description="Solo productos elaborados. Permite cotizar por unidad o al peso."
                checked={allowsUnitOrder}
                onChange={setAllowsUnitOrder}
              />
            ) : null}
          </FormSection>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </AdminDraftModalBody>
        <AdminDraftModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={minimize}
          >
            Minimizar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={discardDraft}
          >
            Descartar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando…" : "Crear producto"}
          </Button>
        </AdminDraftModalFooter>
      </form>
    </AdminDraftModal>
  );
}
