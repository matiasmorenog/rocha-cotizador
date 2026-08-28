import type ExcelJS from "exceljs";
import { cellText } from "@/lib/admin-excel";

/**
 * Column layout for `rocha_data.xlsx` → sheet "Lista de Precios" (row 1 headers):
 *   1 Codigo | 2 Rubro | 3 Detalle Articulo | 4 Minorista | 5 Mayorista | …
 *
 * Product.name  ← col 3 (Detalle Articulo)
 * Product.rubro ← col 2 (Rubro / admin "Tipo")
 */
export const LISTA_PRECIOS_COL = {
  CODE: 1,
  RUBRO: 2,
  NAME: 3,
  MINORISTA: 4,
  MAYORISTA: 5,
  DATA_START_ROW: 5,
} as const;

/** Admin import aliases for round-trip with rocha_data headers. */
export const PRODUCT_CODE_HEADER_ALIASES = ["código", "codigo"] as const;

export const PRODUCT_NAME_HEADER_ALIASES = [
  "nombre",
  "detalle articulo",
  "detalle artículo",
] as const;

export const PRODUCT_RUBRO_HEADER_ALIASES = ["rubro", "tipo"] as const;

export type ParsedListaPreciosProduct = {
  code: string;
  name: string;
  rubro: string | null;
};

export function normalizeProductCode(codeRaw: string): string {
  const t = codeRaw.trim();
  return t.length <= 4 ? t.padStart(4, "0") : t;
}

/** Parse one data row from Lista de Precios; null when row has no product code. */
export function parseListaPreciosProductRow(
  row: ExcelJS.Row,
): ParsedListaPreciosProduct | null {
  const codeRaw = cellText(row.getCell(LISTA_PRECIOS_COL.CODE).value);
  if (!/^\d+$/.test(codeRaw)) return null;

  const name = cellText(row.getCell(LISTA_PRECIOS_COL.NAME).value);
  if (!name) return null;

  const rubro =
    cellText(row.getCell(LISTA_PRECIOS_COL.RUBRO).value) || null;

  return {
    code: normalizeProductCode(codeRaw),
    name,
    rubro,
  };
}

/** Resolve header → column index; accepts rocha_data and admin export names. */
export function resolveProductHeaderColumn(
  headers: Map<string, number>,
  aliases: readonly string[],
): number | undefined {
  for (const alias of aliases) {
    const col = headers.get(alias);
    if (col) return col;
  }
  return undefined;
}
