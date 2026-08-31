import {
  parseArgentinaDateOnlyEndExclusive,
  parseArgentinaDateOnlyStart,
} from "@/lib/argentina-time";
import { addCalendarDaysYmd } from "@/lib/delivery-date";

/** Default rows on /remitos before the customer applies filters or search. */
export const CUSTOMER_REMITOS_DEFAULT_LIMIT = 5;

/** Cap when expanding via date filter or search (avoid unbounded history loads). */
export const CUSTOMER_REMITOS_FILTERED_LIMIT = 100;

/** Max inclusive window between Desde and Hasta (B2B remitos, not a giant search). */
export const CUSTOMER_REMITOS_MAX_RANGE_DAYS = 90;

const MAX_RANGE_MS =
  CUSTOMER_REMITOS_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;

export const CUSTOMER_REMITOS_RANGE_TOO_LONG_ERROR = `El rango no puede superar ${CUSTOMER_REMITOS_MAX_RANGE_DAYS} días. Elegí un período más corto.`;

export function customerRemitosDateRangeError(
  fromYmd: string,
  toYmd: string,
): string | null {
  const from = parseArgentinaDateOnlyStart(fromYmd);
  const toStart = parseArgentinaDateOnlyStart(toYmd);
  const toExclusive = parseArgentinaDateOnlyEndExclusive(toYmd);
  if (!from || !toStart || !toExclusive) {
    return "Fechas inválidas";
  }
  if (from.getTime() > toStart.getTime()) {
    return "El rango es inválido: 'Desde' debe ser anterior o igual a 'Hasta'";
  }
  if (toExclusive.getTime() - from.getTime() > MAX_RANGE_MS) {
    return CUSTOMER_REMITOS_RANGE_TOO_LONG_ERROR;
  }
  return null;
}

/** If Hasta is more than max days after Desde, snap Hasta to Desde + max. */
export function clampCustomerRemitosHasta(
  fromYmd: string,
  toYmd: string,
): string {
  const from = parseArgentinaDateOnlyStart(fromYmd);
  const toExclusive = parseArgentinaDateOnlyEndExclusive(toYmd);
  if (!from || !toExclusive) return toYmd;
  if (toExclusive.getTime() - from.getTime() <= MAX_RANGE_MS) return toYmd;
  return addCalendarDaysYmd(fromYmd, CUSTOMER_REMITOS_MAX_RANGE_DAYS);
}
