export type ImportRowError = { row: number; message: string };

export type ImportDuplicateWarning = {
  code: string;
  rows: number[];
  message: string;
};

export type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
};

export type ImportValidationResult = {
  ok: boolean;
  rowCount: number;
  skipped: number;
  errors: ImportRowError[];
  warnings: ImportDuplicateWarning[];
};

export type ImportFatalFeedback = {
  kind: "fatal";
  title: string;
  detail?: string;
  status?: number;
};

export type ImportResultFeedback = {
  kind: "result";
  summary: ImportSummary;
  entityLabel: string;
};

export type ImportFeedback = ImportFatalFeedback | ImportResultFeedback;

type JsonBody = {
  error?: string;
  message?: string;
  code?: string;
  errors?: ImportRowError[];
  created?: number;
  updated?: number;
  skipped?: number;
};

function bodyMessage(data: JsonBody): string | undefined {
  const msg = data.error ?? data.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : undefined;
}

function isImportSummary(data: JsonBody): data is ImportSummary {
  return (
    typeof data.created === "number" &&
    typeof data.updated === "number" &&
    typeof data.skipped === "number" &&
    Array.isArray(data.errors)
  );
}

/** User-facing copy for HTTP failures during Excel import. */
export function importHttpFatalMessage(
  status: number,
  body?: JsonBody,
): ImportFatalFeedback {
  const apiMsg = body ? bodyMessage(body) : undefined;

  switch (status) {
    case 401:
    case 403:
      return {
        kind: "fatal",
        status,
        title: "Sin autorización",
        detail:
          apiMsg ??
          "Tu sesión expiró o no tenés permiso para importar. Volvé a iniciar sesión e intentá de nuevo.",
      };
    case 413:
      return {
        kind: "fatal",
        status,
        title: "Archivo demasiado grande",
        detail:
          apiMsg ??
          "El archivo supera el límite permitido. Probá un Excel más chico o contactá soporte.",
      };
    case 408:
    case 504:
      return {
        kind: "fatal",
        status,
        title: "Tiempo de espera agotado",
        detail:
          apiMsg ??
          "La importación tardó demasiado (timeout). Archivos grandes pueden fallar: probá dividir el Excel o contactá soporte.",
      };
    case 502:
    case 503:
      return {
        kind: "fatal",
        status,
        title: "Servidor no disponible",
        detail:
          apiMsg ??
          "El servidor no respondió. Esperá un momento y volvé a intentar.",
      };
    case 400:
      return {
        kind: "fatal",
        status,
        title: "Archivo inválido",
        detail: apiMsg ?? "Revisá el formato del Excel (cabeceras y columnas requeridas).",
      };
    case 500:
    default:
      return {
        kind: "fatal",
        status,
        title: status >= 500 ? "Error del servidor" : "No se pudo importar",
        detail:
          apiMsg ??
          (status >= 500
            ? `Error interno (HTTP ${status}). Si persiste, contactá soporte.`
            : `Respuesta inesperada (HTTP ${status}).`),
      };
  }
}

export function importNetworkFatalMessage(): ImportFatalFeedback {
  return {
    kind: "fatal",
    title: "Error de conexión",
    detail:
      "No se pudo contactar al servidor. Verificá tu internet e intentá de nuevo.",
  };
}

export async function parseImportResponse(
  res: Response,
  entityLabel: string,
): Promise<ImportFeedback> {
  const contentType = res.headers.get("content-type") ?? "";
  let data: JsonBody = {};

  if (contentType.includes("application/json")) {
    data = (await res.json().catch(() => ({}))) as JsonBody;
  } else if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (text.trim()) {
      data = { error: text.slice(0, 280) };
    }
  }

  if (!res.ok) {
    return importHttpFatalMessage(res.status, data);
  }

  if (!isImportSummary(data)) {
    return {
      kind: "fatal",
      status: res.status,
      title: "Respuesta inválida",
      detail: bodyMessage(data) ?? "El servidor no devolvió un resumen de importación.",
    };
  }

  return {
    kind: "result",
    summary: data,
    entityLabel,
  };
}

export function importSummaryHeadline(
  summary: ImportSummary,
  entityLabel: string,
): string {
  const errCount = summary.errors.length;
  const parts = [
    `Creados: ${summary.created}`,
    `actualizados: ${summary.updated}`,
    `omitidos: ${summary.skipped}`,
  ];
  if (errCount > 0) {
    parts.push(`filas con error: ${errCount}`);
  }
  return `Sincronización ${entityLabel}: ${parts.join(", ")}.`;
}

export function importHadMutations(summary: ImportSummary): boolean {
  return summary.created > 0 || summary.updated > 0;
}

type ValidationJsonBody = {
  error?: string;
  ok?: boolean;
  rowCount?: number;
  skipped?: number;
  errors?: ImportRowError[];
  warnings?: ImportDuplicateWarning[];
};

function isDuplicateWarning(value: unknown): value is ImportDuplicateWarning {
  if (!value || typeof value !== "object") return false;
  const w = value as ImportDuplicateWarning;
  return (
    typeof w.code === "string" &&
    Array.isArray(w.rows) &&
    w.rows.every((r) => typeof r === "number") &&
    typeof w.message === "string"
  );
}

function isImportValidationResult(
  data: ValidationJsonBody,
): data is ImportValidationResult {
  return (
    typeof data.ok === "boolean" &&
    typeof data.rowCount === "number" &&
    typeof data.skipped === "number" &&
    Array.isArray(data.errors) &&
    Array.isArray(data.warnings) &&
    data.warnings.every(isDuplicateWarning)
  );
}

export async function parseValidationResponse(
  res: Response,
): Promise<
  | { kind: "validation"; result: ImportValidationResult }
  | ImportFatalFeedback
> {
  const contentType = res.headers.get("content-type") ?? "";
  let data: ValidationJsonBody = {};

  if (contentType.includes("application/json")) {
    data = (await res.json().catch(() => ({}))) as ValidationJsonBody;
  } else if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (text.trim()) {
      data = { error: text.slice(0, 280) };
    }
  }

  if (!res.ok) {
    return importHttpFatalMessage(res.status, data);
  }

  if (!isImportValidationResult(data)) {
    return {
      kind: "fatal",
      status: res.status,
      title: "Respuesta inválida",
      detail:
        data.error ?? "El servidor no devolvió un resultado de validación.",
    };
  }

  return { kind: "validation", result: data };
}
