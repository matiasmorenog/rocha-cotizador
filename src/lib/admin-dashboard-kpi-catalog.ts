/** Dashboard KPI catalog — picker + defaults (max 3 visible). */

export const MAX_DASHBOARD_KPIS = 3;

export const DASHBOARD_KPI_IDS = [
  "quotesToday",
  "customersQuotedToday",
  "pendingWeighAll",
  "deliveriesToday",
  "pendingWeighLive",
  "activeCustomersNoQuoteWeek",
  "submittedQuotesToday",
  "branchesMissingDesperdicioToday",
] as const;

export type DashboardKpiId = (typeof DASHBOARD_KPI_IDS)[number];

export type DashboardKpiDef = {
  id: DashboardKpiId;
  label: string;
  /** Short note in the picker checklist. */
  pickerHint: string;
};

/**
 * Full catalog (sets A/B/C + current useful cards).
 * Default visible = set A (ops del día), exactly {@link MAX_DASHBOARD_KPIS}.
 */
export const DASHBOARD_KPI_CATALOG: readonly DashboardKpiDef[] = [
  {
    id: "quotesToday",
    label: "Cotizaciones hoy",
    pickerHint: "Volumen + $ · set B / actual",
  },
  {
    id: "customersQuotedToday",
    label: "Clientes que cotizaron hoy",
    pickerHint: "Distinct hoy · actual",
  },
  {
    id: "pendingWeighAll",
    label: "Pendientes pesaje (histórico)",
    pickerHint: "Todas las líneas · actual",
  },
  {
    id: "deliveriesToday",
    label: "Entregas hoy",
    pickerHint: "deliveryDate = hoy · A/B",
  },
  {
    id: "pendingWeighLive",
    label: "Pendientes pesaje (cola viva)",
    pickerHint: "Hoy/ayer o ≤7d · A/B/C",
  },
  {
    id: "activeCustomersNoQuoteWeek",
    label: "Activos sin pedido esta semana",
    pickerHint: "Chase · set A",
  },
  {
    id: "submittedQuotesToday",
    label: "Remitos SUBMITTED hoy",
    pickerHint: "Por confirmar · set C",
  },
  {
    id: "branchesMissingDesperdicioToday",
    label: "Sin desperdicio hoy",
    pickerHint: "Cierre stock · set C",
  },
] as const;

/** Set A — operación del día (exactly 3). */
export const DEFAULT_DASHBOARD_KPI_IDS: readonly DashboardKpiId[] = [
  "deliveriesToday",
  "pendingWeighLive",
  "activeCustomersNoQuoteWeek",
];

export type DashboardKpiDisplay = {
  value: number | string;
  hint: string;
};

export type DashboardKpiValues = Record<DashboardKpiId, DashboardKpiDisplay>;

export function isDashboardKpiId(id: string): id is DashboardKpiId {
  return (DASHBOARD_KPI_IDS as readonly string[]).includes(id);
}

/** Keep known ids, cap at max, fall back to defaults if empty. */
export function normalizeDashboardKpiSelection(
  ids: unknown,
): DashboardKpiId[] {
  const known = new Set<DashboardKpiId>();
  if (Array.isArray(ids)) {
    for (const raw of ids) {
      if (typeof raw !== "string" || !isDashboardKpiId(raw)) continue;
      if (known.has(raw)) continue;
      known.add(raw);
      if (known.size >= MAX_DASHBOARD_KPIS) break;
    }
  }
  if (known.size === 0) return [...DEFAULT_DASHBOARD_KPI_IDS];
  return DASHBOARD_KPI_IDS.filter((id) => known.has(id));
}
