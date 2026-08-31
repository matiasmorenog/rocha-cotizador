import type { ProductStockKindValue } from "@/lib/stock-product-kind-shared";
import { DEFAULT_PRODUCT_STOCK_KIND } from "@/lib/stock-product-kind-shared";

/** UI label for admin product form / table (DESPERDICIO → «Elaborado»). */
export const PRODUCT_STOCK_KIND_LABELS: Record<ProductStockKindValue, string> =
  {
    DESPERDICIO: "Elaborado",
    CONSUMABLE: "Consumible",
    LOCAL_ASSET: "Activo del local",
  };

export const PRODUCT_STOCK_KIND_DESCRIPTIONS: Record<
  ProductStockKindValue,
  string
> = {
  DESPERDICIO:
    "Panes, masas y comida del día. Carga en Desperdicios (elaborados).",
  CONSUMABLE:
    "Gaseosas, insumos y stock invertido. Recuento en Consumibles.",
  LOCAL_ASSET:
    "Carritos, bandejas y otros activos. Recuento en Activos del local.",
};

export const PRODUCT_STOCK_KIND_OPTIONS: ProductStockKindValue[] = [
  "DESPERDICIO",
  "CONSUMABLE",
  "LOCAL_ASSET",
];

export { DEFAULT_PRODUCT_STOCK_KIND } from "@/lib/stock-product-kind-shared";

export function resolveProductStockKind(
  value: ProductStockKindValue | null | undefined,
): ProductStockKindValue {
  return value ?? DEFAULT_PRODUCT_STOCK_KIND;
}

/** Excel `tipoStock` round-trip (visual «ELABORADO» for desperdicio). */
export function formatStockKindForExport(
  value: ProductStockKindValue | null | undefined,
): string {
  if (!value || value === "DESPERDICIO") return "ELABORADO";
  if (value === "CONSUMABLE") return "CONSUMIBLE";
  return "ACTIVO_LOCAL";
}
