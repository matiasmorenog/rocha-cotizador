"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { StockTab } from "@/lib/admin-stock-data";

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
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({ tab });
    const fromYmd = fromValue.trim();
    const toYmd = toValue.trim();
    if (fromYmd) params.set("from", fromYmd);
    if (toYmd) params.set("to", toYmd);
    router.push(`/stock?${params.toString()}`);
  }

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
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
      <Button type="submit">Filtrar</Button>
    </form>
  );
}
