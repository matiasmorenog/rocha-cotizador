export type ConfigTab = "cotizaciones" | "notificaciones" | "servicio" | "cuenta";

export const CONFIG_TABS: ConfigTab[] = [
  "cotizaciones",
  "notificaciones",
  "servicio",
  "cuenta",
];

export const DEFAULT_CONFIG_TAB: ConfigTab = "cuenta";

export function isConfigTab(value: string): value is ConfigTab {
  return (CONFIG_TABS as string[]).includes(value);
}

export function parseConfigTab(tab?: string): ConfigTab {
  if (tab && isConfigTab(tab)) return tab;
  return DEFAULT_CONFIG_TAB;
}
