"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatetimeLocalPicker } from "@/components/ui/datetime-local-picker";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import type { StockModuleCustomer, StockTab } from "@/lib/admin-stock-data";
import { cn } from "@/lib/utils";

function ymdToPickerValue(ymd: string): string {
  return `${ymd}T00:00`;
}

function pickerValueToYmd(value: string): string {
  return value.slice(0, 10);
}

export function StockPanelFilters({
  customers,
  customerId,
  from,
  to,
  tab,
}: {
  customers: StockModuleCustomer[];
  customerId: string;
  from: string;
  to: string;
  tab: StockTab;
}) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(() => ymdToPickerValue(from));
  const [toValue, setToValue] = useState(() => ymdToPickerValue(to));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams({ tab });
    const fromYmd = pickerValueToYmd(fromValue).trim();
    const toYmd = pickerValueToYmd(toValue).trim();
    const customerValue = String(formData.get("customer") ?? "").trim();
    if (fromYmd) params.set("from", fromYmd);
    if (toYmd) params.set("to", toYmd);
    if (customerValue) params.set("customer", customerValue);
    router.push(`/admin/stock?${params.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={onSubmit}
    >
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
      <label className="flex w-[12.75rem] shrink-0 flex-col gap-1 text-xs text-neutral-600">
        Desde
        <DatetimeLocalPicker
          value={fromValue}
          onChange={setFromValue}
          aria-label="Desde"
        />
      </label>
      <label className="flex w-[12.75rem] shrink-0 flex-col gap-1 text-xs text-neutral-600">
        Hasta
        <DatetimeLocalPicker
          value={toValue}
          onChange={setToValue}
          aria-label="Hasta"
        />
      </label>
      <Button type="submit">Filtrar</Button>
    </form>
  );
}
