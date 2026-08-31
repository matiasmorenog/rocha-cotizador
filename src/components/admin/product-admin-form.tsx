"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSection } from "@/components/admin/form-section";
import { FormToggleCard } from "@/components/admin/form-toggle-card";
import { ProductStockKindPicker } from "@/components/admin/product-stock-kind-picker";
import { ProductTipoField } from "@/components/admin/product-tipo-field";
import { Button } from "@/components/ui/button";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** Compact create-only form. Edits (incl. list prices) happen inline in ProductAdminTable. */
export function ProductAdminForm({
  rubros,
  onCancel,
}: {
  rubros: string[];
  onCancel: () => void;
}) {
  const router = useRouter();
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
      router.refresh();
      onCancel();
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

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <p className="text-sm font-medium text-neutral-800">Nuevo producto</p>

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
          <ProductTipoField rubros={rubros} value={rubro} onChange={onRubroChange} />
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
        <ProductStockKindPicker value={stockKind} onChange={onStockKindChange} />
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
