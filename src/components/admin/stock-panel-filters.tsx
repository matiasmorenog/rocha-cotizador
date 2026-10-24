"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  ProductPicker,
  type CatalogSearchProduct,
} from "@/components/quote/product-picker";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import type {
  StockFilterProduct,
  StockModuleCustomer,
  StockTab,
} from "@/lib/admin-stock-data";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import { cn } from "@/lib/utils";

function toPickerProduct(
  product: StockFilterProduct | null,
): CatalogSearchProduct | null {
  if (!product) return null;
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    rubro: product.rubro,
    unitPrice: product.unitPrice,
    allowsUnitOrder: product.allowsUnitOrder,
    stockKind: product.stockKind,
  };
}

export function StockPanelFilters({
  customers,
  customerId,
  from,
  to,
  tab,
  stockModule,
  product,
}: {
  customers: StockModuleCustomer[];
  customerId: string;
  from: string;
  to: string;
  tab: StockTab;
  stockModule: StockModuleKey;
  product: StockFilterProduct | null;
}) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);
  const [picked, setPicked] = useState<CatalogSearchProduct | null>(() =>
    toPickerProduct(product),
  );

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams({ tab });
    const fromYmd = fromValue.trim();
    const toYmd = toValue.trim();
    const customerValue = String(formData.get("customer") ?? "").trim();
    if (fromYmd) params.set("from", fromYmd);
    if (toYmd) params.set("to", toYmd);
    if (customerValue) params.set("customer", customerValue);
    if (picked?.id) params.set("product", picked.id);
    router.push(`/admin/stock?${params.toString()}`);
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`stock-customer-${tab}`}>Sucursal</Label>
          <select
            id={`stock-customer-${tab}`}
            name="customer"
            defaultValue={customerId}
            className={cn(
              "flex h-10 w-full min-w-[14rem] rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-10 text-sm",
              FOCUS_BRAND_BORDER,
            )}
          >
            <option value="">Todas</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.code} · {customer.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-w-[14rem] shrink-0 flex-col gap-1 text-xs text-neutral-600">
          Período
          <DateRangePicker
            from={fromValue}
            to={toValue}
            onChange={(nextFrom, nextTo) => {
              setFromValue(nextFrom);
              setToValue(nextTo);
            }}
            aria-label="Período"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] max-w-xl flex-1">
          <ProductPicker
            value={picked}
            onChange={setPicked}
            adminStockModule={stockModule}
            inputId={`stock-filter-product-${tab}`}
          />
        </div>
        <Button type="submit" className="shrink-0 self-end">
          Filtrar
        </Button>
      </div>
    </form>
  );
}
