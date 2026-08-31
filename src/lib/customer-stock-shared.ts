import type { CustomerModule } from "@prisma/client";
import { CUSTOMER_MODULE_LABELS } from "@/lib/customer-modules";
import type { StockTab } from "@/lib/admin-stock-data";
import type { CustomerModuleSession } from "@/types/auth";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";

export const CUSTOMER_STOCK_TABS: Array<{
  tab: StockTab;
  module: CustomerModule;
  stockModule: StockModuleKey;
  apiSegment: string;
}> = [
  {
    tab: "desperdicios",
    module: "DESPERDICIOS",
    stockModule: "DESPERDICIOS",
    apiSegment: "desperdicios",
  },
  {
    tab: "consumibles",
    module: "CONSUMABLES",
    stockModule: "CONSUMABLES",
    apiSegment: "consumibles",
  },
  {
    tab: "activos",
    module: "ACTIVOS",
    stockModule: "ACTIVOS",
    apiSegment: "activos",
  },
];

export function customerStockTabsForModules(
  modules: CustomerModuleSession[],
): typeof CUSTOMER_STOCK_TABS {
  const enabled = new Set(modules);
  return CUSTOMER_STOCK_TABS.filter((row) => enabled.has(row.module));
}

export function parseCustomerStockTab(
  tabParam: string | undefined,
  modules: CustomerModuleSession[],
): (typeof CUSTOMER_STOCK_TABS)[number] | null {
  const available = customerStockTabsForModules(modules);
  if (available.length === 0) return null;
  const normalized =
    tabParam === "elaborados" || tabParam === "mermas"
      ? "desperdicios"
      : tabParam;
  const match = available.find((row) => row.tab === normalized);
  return match ?? available[0]!;
}

export function customerStockTabLabel(tab: StockTab): string {
  const row = CUSTOMER_STOCK_TABS.find((r) => r.tab === tab);
  return row ? CUSTOMER_MODULE_LABELS[row.module] : tab;
}

export function customerStockApiSegment(module: CustomerModule): string {
  const row = CUSTOMER_STOCK_TABS.find((r) => r.module === module);
  if (!row) throw new Error("Invalid stock module");
  return row.apiSegment;
}

export function customerStockModuleFromApiSegment(
  segment: string,
): CustomerModule | null {
  const legacy =
    segment === "mermas" || segment === "elaborados" ? "desperdicios" : segment;
  const row = CUSTOMER_STOCK_TABS.find((r) => r.apiSegment === legacy);
  return row?.module ?? null;
}
