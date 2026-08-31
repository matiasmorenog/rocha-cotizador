import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { invalidateAfterCustomerMutation } from "@/lib/cache-tags";
import { normalizePhone } from "@/lib/phone-contact";
import { padCustomerCode, pinFromCustomerCode } from "@/lib/utils";
import {
  cellText,
  duplicateCodeWarnings,
  emptyToNull,
  getCellByHeader,
  headerIndexMap,
  parseBool,
  workbookFromBuffer,
  type ImportSummary,
  type ImportValidationResult,
} from "@/lib/admin-excel";
import { isBasePriceListLabel } from "@/lib/pricing";
import { getBasePriceList } from "@/lib/price-list-resolve";
import { emptyToNullNameNote } from "@/lib/customer-name-note";

export type CustomersImportContext = {
  sheet: ExcelJS.Worksheet;
  headers: Map<string, number>;
  listByName: Map<string, string>;
  baseListId: string | null;
};

type LoadError = { ok: false; error: string; status: number };
type LoadOk = { ok: true; ctx: CustomersImportContext };

export async function loadCustomersImportFromBuffer(
  buf: ArrayBuffer,
): Promise<LoadOk | LoadError> {
  let workbook: ExcelJS.Workbook;
  try {
    workbook = await workbookFromBuffer(buf);
  } catch {
    return { ok: false, error: "No se pudo leer el Excel", status: 400 };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { ok: false, error: "Hoja vacía o sin datos", status: 400 };
  }

  const headers = headerIndexMap(sheet.getRow(1));
  if (headers.has("activo") && !headers.has("habilitado")) {
    headers.set("habilitado", headers.get("activo")!);
  }
  if (!headers.has("código") || !headers.has("nombre")) {
    return {
      ok: false,
      error:
        "Cabeceras requeridas: código, nombre (ver export clientes.xlsx)",
      status: 400,
    };
  }

  const priceLists = await db.priceList.findMany({
    select: { id: true, name: true },
  });
  const listByName = new Map(
    priceLists.map((l) => [l.name.trim().toLowerCase(), l.id]),
  );
  const baseList = await getBasePriceList();

  return {
    ok: true,
    ctx: {
      sheet,
      headers,
      listByName,
      baseListId: baseList?.id ?? null,
    },
  };
}

function validateCustomersRow(
  row: ExcelJS.Row,
  ctx: CustomersImportContext,
): { skip: boolean; error?: string } {
  const codeRaw = cellText(getCellByHeader(row, ctx.headers, "código"));
  const name = cellText(getCellByHeader(row, ctx.headers, "nombre"));

  if (!codeRaw && !name) {
    return { skip: true };
  }

  if (!codeRaw) {
    return { skip: false, error: "Falta código" };
  }
  if (!name) {
    return { skip: false, error: "Falta nombre" };
  }

  const code = padCustomerCode(codeRaw);
  if (!/^\d{3}$/.test(code)) {
    return { skip: false, error: `Código inválido: ${codeRaw}` };
  }

  const listRaw = cellText(
    getCellByHeader(row, ctx.headers, "listaprecios"),
  ).trim();
  if (!isBasePriceListLabel(listRaw)) {
    const id = ctx.listByName.get(listRaw.toLowerCase());
    if (!id) {
      return { skip: false, error: `Lista desconocida: ${listRaw}` };
    }
  }

  return { skip: false };
}

function customerImportCodeKey(codeRaw: string): string {
  const padded = padCustomerCode(codeRaw);
  if (/^\d{3}$/.test(padded)) return padded;
  return codeRaw.trim();
}

export function validateCustomersImport(
  ctx: CustomersImportContext,
): ImportValidationResult {
  const result: ImportValidationResult = {
    ok: true,
    rowCount: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  const codeRows: Array<{ row: number; code: string }> = [];

  for (let r = 2; r <= ctx.sheet.rowCount; r++) {
    const row = ctx.sheet.getRow(r);
    const codeRaw = cellText(getCellByHeader(row, ctx.headers, "código"));
    const name = cellText(getCellByHeader(row, ctx.headers, "nombre"));

    if (!codeRaw && !name) {
      result.skipped += 1;
      continue;
    }

    if (codeRaw.trim()) {
      codeRows.push({ row: r, code: customerImportCodeKey(codeRaw) });
    }

    const outcome = validateCustomersRow(row, ctx);
    if (outcome.skip) {
      continue;
    }
    if (outcome.error) {
      result.errors.push({ row: r, message: outcome.error });
      continue;
    }
    result.rowCount += 1;
  }

  result.warnings = duplicateCodeWarnings(codeRows);
  result.ok = result.errors.length === 0;
  return result;
}

export async function executeCustomersImport(
  ctx: CustomersImportContext,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let r = 2; r <= ctx.sheet.rowCount; r++) {
    const row = ctx.sheet.getRow(r);
    const codeRaw = cellText(getCellByHeader(row, ctx.headers, "código"));
    const name = cellText(getCellByHeader(row, ctx.headers, "nombre"));
    const nameNote = emptyToNullNameNote(
      cellText(getCellByHeader(row, ctx.headers, "aclaración")),
    );

    if (!codeRaw && !name) {
      summary.skipped += 1;
      continue;
    }

    const validation = validateCustomersRow(row, ctx);
    if (validation.skip) {
      summary.skipped += 1;
      continue;
    }
    if (validation.error) {
      summary.errors.push({ row: r, message: validation.error });
      continue;
    }

    const code = padCustomerCode(codeRaw);
    const listRaw = cellText(
      getCellByHeader(row, ctx.headers, "listaprecios"),
    ).trim();
    let priceListId: string | null = ctx.baseListId;
    if (!isBasePriceListLabel(listRaw)) {
      priceListId = ctx.listByName.get(listRaw.toLowerCase()) ?? null;
    }

    const phoneRaw = emptyToNull(
      cellText(getCellByHeader(row, ctx.headers, "teléfono")),
    );
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    const email = emptyToNull(cellText(getCellByHeader(row, ctx.headers, "email")));
    const address = emptyToNull(
      cellText(getCellByHeader(row, ctx.headers, "dirección")),
    );
    const paymentTerms = emptyToNull(
      cellText(getCellByHeader(row, ctx.headers, "condicionesPago")),
    );
    const deliveryHours = emptyToNull(
      cellText(getCellByHeader(row, ctx.headers, "horarioEntrega")),
    );
    const notes = emptyToNull(cellText(getCellByHeader(row, ctx.headers, "notas")));
    const active = parseBool(
      getCellByHeader(row, ctx.headers, "habilitado"),
      true,
    );
    const resetPin = parseBool(
      getCellByHeader(row, ctx.headers, "resetearPin"),
      false,
    );

    try {
      const existing = await db.customer.findUnique({ where: { code } });

      if (existing) {
        const data: {
          name: string;
          nameNote: string | null;
          priceListId: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          paymentTerms: string | null;
          deliveryHours: string | null;
          active: boolean;
          passwordHash?: string;
          mustChangePassword?: boolean;
        } = {
          name,
          nameNote,
          priceListId,
          address,
          phone,
          email,
          notes,
          paymentTerms,
          deliveryHours,
          active,
        };

        if (resetPin) {
          const pin = pinFromCustomerCode(code);
          data.passwordHash = await bcrypt.hash(pin, 10);
          data.mustChangePassword = true;
        }

        await db.customer.update({ where: { code }, data });
        summary.updated += 1;
      } else {
        const pin = pinFromCustomerCode(code);
        const passwordHash = await bcrypt.hash(pin, 10);
        await db.customer.create({
          data: {
            code,
            name,
            nameNote,
            passwordHash,
            mustChangePassword: true,
            priceListId,
            address,
            phone,
            email,
            notes,
            paymentTerms,
            deliveryHours,
            active,
          },
        });
        summary.created += 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al guardar";
      summary.errors.push({ row: r, message });
    }
  }

  if (summary.created > 0 || summary.updated > 0) {
    invalidateAfterCustomerMutation();
  }

  return summary;
}
