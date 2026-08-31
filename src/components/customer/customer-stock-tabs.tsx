"use client";

import { SolapasTabLink, SolapasTabList } from "@/components/ui/solapas-tabs";
import type { StockTab } from "@/lib/admin-stock-data";
import { customerStockTabLabel } from "@/lib/customer-stock-shared";

export function CustomerStockTabs({
  active,
  tabs,
  from,
  to,
}: {
  active: StockTab;
  tabs: StockTab[];
  from: string;
  to: string;
}) {
  if (tabs.length <= 1) return null;

  return (
    <SolapasTabList activeKey={active} aria-label="Stock">
      {tabs.map((tab) => {
        const params = new URLSearchParams({ tab });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        return (
          <SolapasTabLink
            key={tab}
            href={`/stock?${params.toString()}`}
            selected={active === tab}
          >
            {customerStockTabLabel(tab)}
          </SolapasTabLink>
        );
      })}
    </SolapasTabList>
  );
}
