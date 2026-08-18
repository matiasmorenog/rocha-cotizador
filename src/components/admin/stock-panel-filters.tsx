"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import type { StockModuleCustomer, StockTab } from "@/lib/admin-stock-data";
import { cn } from "@/lib/utils";

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

  function applyFilter(formData: FormData) {
    const params = new URLSearchParams({ tab });
    const fromValue = String(formData.get("from") ?? "").trim();
    const toValue = String(formData.get("to") ?? "").trim();
    const customerValue = String(formData.get("customer") ?? "").trim();
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    if (customerValue) params.set("customer", customerValue);
    router.push(`/admin/stock?${params.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      action={applyFilter}
    >
      <div className="space-y-1">
        <Label htmlFor={`stock-customer-${tab}`}>Sucursal</Label>
        <select
          id={`stock-customer-${tab}`}
          name="customer"
          defaultValue={customerId}
          className={cn(
            "h-10 w-full min-w-[14rem] rounded-md border border-neutral-200 bg-white px-3 text-sm",
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
      <div className="space-y-1">
        <Label htmlFor={`stock-from-${tab}`}>Desde</Label>
        <Input
          id={`stock-from-${tab}`}
          name="from"
          type="date"
          defaultValue={from}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`stock-to-${tab}`}>Hasta</Label>
        <Input
          id={`stock-to-${tab}`}
          name="to"
          type="date"
          defaultValue={to}
        />
      </div>
      <Button type="submit">Filtrar</Button>
    </form>
  );
}
