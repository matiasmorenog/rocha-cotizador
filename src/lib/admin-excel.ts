/**
 * Admin Excel export/import — stable Spanish column headers (round-trip).
 *
 * Customers (`clientes.xlsx`):
 *   código | nombre | email | teléfono | dirección | condicionesPago |
 *   horarioEntrega | notas | listaPrecios | activo | resetearPin
 *   - `listaPrecios`: name of PriceList or "Mayorista (base)" / empty for base.
 *   - `resetearPin` exported empty; on import, truthy values reset PIN via pinFromCustomerCode.
 *   - Password never exported. New customers always get PIN from code; existing keep passwordHash
 *     unless resetearPin is set.
 *
 * Products (`productos.xlsx`):
 *   código | nombre | rubro | precioBase | activo
 *
 * Quotes range export is PDF (`/api/admin/quotes/export`) — see `quotes-export-pdf.ts`.
 */

import ExcelJS from "exceljs";

export const CUSTOMER_COLUMNS = [
  "código",
  "nombre",
  "email",
  "teléfono",
  "dirección",
  "condicionesPago",
  "horarioEntrega",
  "notas",
  "listaPrecios",
  "activo",
  "resetearPin",
] as const;

export const PRODUCT_COLUMNS = [
  "código",
  "nombre",
  "rubro",
  "precioBase",
  "activo",
] as const;

export type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) {
    return String((value as { text?: unknown }).text ?? "").trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellText((value as { result: ExcelJS.CellValue }).result);
  }
  if (typeof value === "object" && "richText" in value) {
    const parts = (value as { richText: Array<{ text: string }> }).richText;
    return parts.map((p) => p.text).join("").trim();
  }
  return String(value).trim();
}

export function cellNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = cellText(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Parse activo / sí / no / 1 / 0 / true / false. Empty → defaultValue. */
export function parseBool(
  value: ExcelJS.CellValue,
  defaultValue: boolean,
): boolean {
  const raw = cellText(value).toLowerCase();
  if (!raw) return defaultValue;
  if (["1", "true", "sí", "si", "yes", "activo", "x"].includes(raw)) return true;
  if (["0", "false", "no", "inactivo"].includes(raw)) return false;
  return defaultValue;
}

export function formatBool(v: boolean): string {
  return v ? "sí" : "no";
}

export function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

/** Map header row → column index (1-based). Case-insensitive, trim. */
export function headerIndexMap(
  headerRow: ExcelJS.Row,
): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = cellText(cell.value).toLowerCase();
    if (key) map.set(key, colNumber);
  });
  return map;
}

export function getCellByHeader(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  name: string,
): ExcelJS.CellValue {
  const col = headers.get(name.toLowerCase());
  if (!col) return null;
  return row.getCell(col).value;
}

export async function workbookFromBuffer(buf: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buf) as unknown as ExcelJS.Buffer);
  return workbook;
}

export function xlsxResponse(
  buffer: ExcelJS.Buffer,
  filename: string,
): Response {
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true };
  }
}
