import Link from "next/link";
import { CUSTOMER_MODULE_LABELS } from "@/lib/customer-modules";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import type { StockTab } from "@/lib/admin-stock-data";
import { cn } from "@/lib/utils";

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
    <div
      role="tablist"
      aria-label="Stock"
      className="inline-flex gap-1 rounded-lg border border-neutral-200 bg-white p-1"
    >
      {TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tabHref(tab.id, from, to, customerId)}
            role="tab"
            aria-selected={selected}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              FOCUS_BRAND_OUTLINE,
              selected
                ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
