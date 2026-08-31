"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DatetimeLocalPicker } from "@/components/ui/datetime-local-picker";
import type { StockTab } from "@/lib/admin-stock-data";

function ymdToPickerValue(ymd: string): string {
  return `${ymd}T00:00`;
}

function pickerValueToYmd(value: string): string {
  return value.slice(0, 10);
}

export function CustomerStockDateFilters({
  from,
  to,
  tab,
}: {
  from: string;
  to: string;
  tab: StockTab;
}) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(() => ymdToPickerValue(from));
  const [toValue, setToValue] = useState(() => ymdToPickerValue(to));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({ tab });
    const fromYmd = pickerValueToYmd(fromValue).trim();
    const toYmd = pickerValueToYmd(toValue).trim();
    if (fromYmd) params.set("from", fromYmd);
    if (toYmd) params.set("to", toYmd);
    router.push(`/stock?${params.toString()}`);
  }

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
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
