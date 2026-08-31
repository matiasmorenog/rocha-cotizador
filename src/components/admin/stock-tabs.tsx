import { SolapasTabLink, SolapasTabList } from "@/components/ui/solapas-tabs";
import { CUSTOMER_MODULE_LABELS } from "@/lib/customer-modules";
import type { StockTab } from "@/lib/admin-stock-data";

const TABS: Array<{ id: StockTab; label: string }> = [
  { id: "desperdicios", label: CUSTOMER_MODULE_LABELS.DESPERDICIOS },
  { id: "consumibles", label: CUSTOMER_MODULE_LABELS.CONSUMABLES },
  { id: "activos", label: CUSTOMER_MODULE_LABELS.ACTIVOS },
];

function tabHref(tab: StockTab, from: string, to: string, customerId: string) {
  const params = new URLSearchParams({ tab });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (customerId) params.set("customer", customerId);
  return `/admin/stock?${params}`;
}

export function StockTabs({
  active,
  from,
  to,
  customerId,
}: {
  active: StockTab;
  from: string;
  to: string;
  customerId: string;
}) {
  return (
    <SolapasTabList activeKey={active} aria-label="Stock">
      {TABS.map((tab) => (
        <SolapasTabLink
          key={tab.id}
          href={tabHref(tab.id, from, to, customerId)}
          selected={active === tab.id}
        >
          {tab.label}
        </SolapasTabLink>
      ))}
    </SolapasTabList>
  );
}
