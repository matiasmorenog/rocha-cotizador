import {
  FILTER_DEFAULT_RANGE_DAYS,
  FILTER_LAST_MONTH_RANGE_DAYS,
  argentinaTodayYmd,
  defaultFilterDateRange,
  lastMonthFilterDateRange,
} from "@/lib/argentina-time";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Normalize URL/server YMD to date-only picker value (identity for YMD). */
export function ymdToPickerValue(ymd: string): string {
  return ymd.trim().slice(0, 10);
}

/** Read YYYY-MM-DD from picker value (date-only or legacy datetime-local). */
export function pickerValueToYmd(value: string): string {
  return value.trim().slice(0, 10);
}

export function formatYmdDisplay(ymd: string): string {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatYmdRangeDisplay(from: string, to: string): string {
  const fromYmd = from.trim();
  const toYmd = to.trim();
  if (!fromYmd && !toYmd) return "Elegir rango";
  if (fromYmd && toYmd) {
    return `${formatYmdDisplay(fromYmd)} – ${formatYmdDisplay(toYmd)}`;
  }
  if (fromYmd) return `${formatYmdDisplay(fromYmd)} – …`;
  return `… – ${formatYmdDisplay(toYmd)}`;
}

export {
  FILTER_DEFAULT_RANGE_DAYS,
  FILTER_LAST_MONTH_RANGE_DAYS,
  argentinaTodayYmd,
  defaultFilterDateRange,
  lastMonthFilterDateRange,
};
