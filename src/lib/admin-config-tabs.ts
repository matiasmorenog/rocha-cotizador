import { isOrderCutoffEnforced } from "@/lib/order-cutoff";
import { isSubscriptionBillingEnabled } from "@/lib/subscription-billing";

export type ConfigTab = "cotizaciones" | "notificaciones" | "servicio" | "cuenta";

/** All config tabs including paused ones (for typing / deep links). */
export const ALL_CONFIG_TABS: ConfigTab[] = [
  "cotizaciones",
  "notificaciones",
  "servicio",
  "cuenta",
];

/**
 * Visible config tabs —
 * Cotizaciones hidden while order cutoff is paused;
 * Servicio hidden when subscription billing is off (demo / dev).
 */
export const CONFIG_TABS: ConfigTab[] = ALL_CONFIG_TABS.filter((tab) => {
  if (tab === "cotizaciones" && !isOrderCutoffEnforced()) return false;
  if (tab === "servicio" && !isSubscriptionBillingEnabled()) return false;
  return true;
});

/** Always the first visible tab (shifts if Cotizaciones is paused/restored). */
export const DEFAULT_CONFIG_TAB: ConfigTab = CONFIG_TABS[0] ?? "cuenta";

export function isConfigTab(value: string): value is ConfigTab {
  return (CONFIG_TABS as string[]).includes(value);
}

export function parseConfigTab(tab?: string): ConfigTab {
  if (tab && isConfigTab(tab)) return tab;
  // Deep link to paused Cotizaciones → fall back to first visible tab.
  return DEFAULT_CONFIG_TAB;
}
