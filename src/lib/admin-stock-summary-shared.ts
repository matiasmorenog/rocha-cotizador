import { parseDateOnlyYmd } from "@/lib/delivery-date";
import {
  FILTER_DEFAULT_RANGE_DAYS,
  defaultFilterDateRange,
} from "@/lib/argentina-time";
import type { StockTab } from "@/lib/admin-stock-data";

export const STOCK_DEFAULT_RANGE_DAYS = FILTER_DEFAULT_RANGE_DAYS;

export type StockSummaryProductRow = {
  productId: string;
  code: string;
  name: string;
  unit: string;
  totalQty: number;
  basePrice: number;
  totalCost: number;
  avgCostPerDay: number;
  lastEntryDate: string | null;
};

export type StockSummaryDailyPoint = {
  date: string;
  label: string;
  totalCost: number;
};

export type StockSummaryPayload = {
  tab: StockTab;
  from: string;
  to: string;
  dayCount: number;
  entryCount: number;
  distinctProducts: number;
  totalBaseCost: number;
  avgBaseCostPerDay: number;
  products: StockSummaryProductRow[];
  daily: StockSummaryDailyPoint[];
};

export function defaultStockDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  return defaultFilterDateRange(now);
}

export function resolveStockDateRange(fromParam?: string, toParam?: string): {
  from: string;
  to: string;
} {
  const defaults = defaultStockDateRange();
  const from =
    fromParam && parseDateOnlyYmd(fromParam) ? fromParam.trim() : defaults.from;
  const to =
    toParam && parseDateOnlyYmd(toParam) ? toParam.trim() : defaults.to;
  return { from, to };
}

export function stockSummaryDayCount(from: string, to: string): number {
  const fromDate = parseDateOnlyYmd(from);
  const toDate = parseDateOnlyYmd(to);
  if (!fromDate || !toDate || from > to) return 1;
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

export function formatStockDayLabel(ymd: string): string {
  const date = parseDateOnlyYmd(ymd);
  if (!date) return ymd;
  return date.toLocaleDateString("es-AR", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

export function parseStockSummaryTab(tab?: string | null): StockTab | null {
  if (tab === "desperdicios" || tab === "elaborados") return "desperdicios";
  if (tab === "consumibles" || tab === "activos") return tab;
  return null;
}
