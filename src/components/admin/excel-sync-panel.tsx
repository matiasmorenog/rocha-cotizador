"use client";

import {
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { notifyCatalogStale } from "@/lib/client-catalog-cache";
import {
  importHadMutations,
  importNetworkFatalMessage,
  importSummaryHeadline,
  parseImportResponse,
  parseValidationResponse,
  summarizeImportRowErrors,
  type ImportFeedback,
  type ImportValidationResult,
} from "@/lib/import-feedback";
import {
  ImportDuplicateWarningsBox,
  ImportFatalFeedbackBox,
  ImportSuccessFeedbackBox,
} from "@/components/admin/import-feedback-box";
import { cn } from "@/lib/utils";

type ExcelSyncPanelProps = {
  exportUrl: string;
  importUrl: string;
  entityLabel: string;
  /** After a successful product import, other tabs should refresh catalog. */
  broadcastCatalogStale?: boolean;
};

type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "validated"; result: ImportValidationResult }
  | { status: "failed"; feedback: ImportFeedback };

const XLSX_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isXlsxFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function ExcelSyncPanel({
  exportUrl,
  importUrl,
  entityLabel,
  broadcastCatalogStale = false,
}: ExcelSyncPanelProps) {
  const router = useRouter();
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({
    status: "idle",
  });
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(
    null,
  );

  function resetValidation() {
    setValidation({ status: "idle" });
    setImportFeedback(null);
  }

  function onFileChange(next: File | null) {
    setFile(next);
    resetValidation();
  }

  function pickFile(next: File | null) {
    if (!next) {
      onFileChange(null);
      return;
    }
    if (!isXlsxFile(next)) {
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
      setValidation({
        status: "failed",
        feedback: {
          kind: "fatal",
          title: "Archivo inválido",
          detail: "Solo se aceptan archivos .xlsx.",
        },
      });
      setImportFeedback(null);
      return;
    }
    onFileChange(next);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (busy) return;
    const next = e.dataTransfer.files?.[0] ?? null;
    pickFile(next);
  }

  function onDropzoneKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (busy) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  async function onValidate(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setValidation({
        status: "failed",
        feedback: {
          kind: "fatal",
          title: "Falta archivo",
          detail: "Elegí un archivo .xlsx antes de validar.",
        },
      });
      return;
    }

    setValidation({ status: "validating" });
    setImportFeedback(null);

    const body = new FormData();
    body.set("file", file);

    try {
      const res = await fetch(`${importUrl}?mode=validate`, {
        method: "POST",
        body,
      });
      const parsed = await parseValidationResponse(res);
      if (parsed.kind === "fatal") {
        setValidation({ status: "failed", feedback: parsed });
        return;
      }
      setValidation({ status: "validated", result: parsed.result });
    } catch {
      setValidation({
        status: "failed",
        feedback: importNetworkFatalMessage(),
      });
    }
  }

  async function onConfirmImport() {
    if (!file) return;
    if (
      validation.status !== "validated" ||
      !validation.result.ok
    ) {
      return;
    }

    setImporting(true);
    setImportFeedback(null);

    const body = new FormData();
    body.set("file", file);

    try {
      const res = await fetch(importUrl, { method: "POST", body });
      const parsed = await parseImportResponse(res, entityLabel);
      setImportFeedback(parsed);

      if (parsed.kind === "result") {
        const { summary } = parsed;
        const hadErrors = summary.errors.length > 0;
        const hadMutations = importHadMutations(summary);

        if (!hadErrors || hadMutations) {
          setFile(null);
          if (inputRef.current) inputRef.current.value = "";
          resetValidation();
        }
        if (hadMutations && broadcastCatalogStale) notifyCatalogStale();
        if (hadMutations) router.refresh();
      }
    } catch {
      setImportFeedback(importNetworkFatalMessage());
    } finally {
      setImporting(false);
    }
  }

  const validating = validation.status === "validating";
  const busy = validating || importing;
  const validated =
    validation.status === "validated" ? validation.result : null;
  const validationFailed =
    validation.status === "failed" ? validation.feedback : null;
  const canConfirm =
    validated?.ok === true && !importing && !validating && file != null;

  const resultFeedback = importFeedback?.kind === "result" ? importFeedback : null;
  const importFatalFeedback =
    importFeedback?.kind === "fatal" ? importFeedback : null;
  const validationFatalFeedback =
    validationFailed?.kind === "fatal" ? validationFailed : null;

  const rowErrors = resultFeedback?.summary.errors ?? [];
  const hasRowErrors = rowErrors.length > 0;
  const partialResult =
    resultFeedback != null && hasRowErrors && importHadMutations(resultFeedback.summary);
  const failedResult =
    resultFeedback != null && hasRowErrors && !importHadMutations(resultFeedback.summary);

  const validationErrors = validated?.errors ?? [];
  const validationWarnings = validated?.warnings ?? [];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          open
            ? "Ocultar sincronización Excel"
            : "Mostrar sincronización Excel"
        }
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50",
          FOCUS_BRAND_BORDER,
          open && "rounded-t-lg",
          !open && "rounded-lg",
        )}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-neutral-900">
            Excel
          </span>
          <span className="mt-0.5 block text-xs font-normal text-neutral-500">
            {open
              ? "Ocultar descarga e importación"
              : "Descargar o importar .xlsx"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-neutral-500 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div id={panelId} className="space-y-3 border-t border-neutral-100 px-4 pb-4 pt-3">
          <p className="text-xs text-neutral-500">
            Descargá la lista o subí un .xlsx. Primero validá el archivo; después
            confirmá la sincronización (upsert por código).
          </p>

          <form onSubmit={onValidate} className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept={XLSX_ACCEPT}
              className="sr-only"
              onChange={(ev) => pickFile(ev.target.files?.[0] ?? null)}
            />

            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              aria-label={
                file
                  ? `Archivo seleccionado: ${file.name}. Clic o soltá otro .xlsx para cambiar.`
                  : "Arrastrá un archivo .xlsx o hacé clic para elegir"
              }
              onClick={() => {
                if (!busy) inputRef.current?.click();
              }}
              onKeyDown={onDropzoneKeyDown}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                "flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
                FOCUS_BRAND_BORDER,
                dragOver
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]"
                  : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100/80",
                busy && "pointer-events-none cursor-not-allowed opacity-50",
              )}
            >
              <FileSpreadsheet
                className={cn(
                  "size-8 shrink-0",
                  dragOver
                    ? "text-[var(--brand-primary)]"
                    : "text-neutral-400",
                )}
                aria-hidden
              />
              <p className="text-sm font-medium text-neutral-800">
                {file ? file.name : "Arrastrá un .xlsx acá"}
              </p>
              <p className="text-xs text-neutral-500">
                {file
                  ? "Clic o soltá otro archivo para cambiar"
                  : "o hacé clic para elegir archivo"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={exportUrl}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50",
                  FOCUS_BRAND_BORDER,
                )}
              >
                <Download className="size-4 shrink-0" aria-hidden />
                Descargar Excel
              </a>

              <Button
                type="submit"
                variant="secondary"
                className="h-10 shrink-0 gap-1.5"
                disabled={busy || !file}
              >
                {validating ? (
                  <>
                    <Spinner className="size-4" />
                    Validando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                    Validar archivo
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="primary"
                className="h-10 shrink-0 gap-1.5"
                disabled={!canConfirm}
                onClick={() => void onConfirmImport()}
              >
                {importing ? (
                  <>
                    <Spinner className="size-4" />
                    Sincronizando…
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4 shrink-0" aria-hidden />
                    Confirmar sincronización
                  </>
                )}
              </Button>
            </div>
          </form>

          {validationFatalFeedback ? (
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <ImportFatalFeedbackBox feedback={validationFatalFeedback} />
            </div>
          ) : null}

          {validated ? (
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              {validated.ok ? (
                <ImportSuccessFeedbackBox
                  headline={`Listo para importar ${validated.rowCount} fila${validated.rowCount === 1 ? "" : "s"}${validated.skipped > 0 ? ` (${validated.skipped} fila${validated.skipped === 1 ? "" : "s"} vacía${validated.skipped === 1 ? "" : "s"} omitida${validated.skipped === 1 ? "" : "s"})` : ""}${validationWarnings.length > 0 ? `. ${validationWarnings.length} advertencia${validationWarnings.length === 1 ? "" : "s"} de código duplicado` : ""}.`}
                  partial={false}
                  title={
                    validationWarnings.length > 0
                      ? "Validación correcta con advertencias"
                      : "Validación correcta"
                  }
                />
              ) : (
                <ImportFatalFeedbackBox
                  feedback={{
                    kind: "fatal",
                    title: "Validación con errores",
                    detail: [
                      "Corregí el Excel antes de sincronizar.",
                      `${validated.rowCount} fila${validated.rowCount === 1 ? "" : "s"} válida${validated.rowCount === 1 ? "" : "s"}, ${validationErrors.length} con error.`,
                      summarizeImportRowErrors(validationErrors),
                    ]
                      .filter(Boolean)
                      .join(" "),
                  }}
                />
              )}

              {validationWarnings.length > 0 ? (
                <ImportDuplicateWarningsBox warnings={validationWarnings} />
              ) : null}
            </div>
          ) : null}

          {importFeedback ? (
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              {importFatalFeedback ? (
                <ImportFatalFeedbackBox feedback={importFatalFeedback} />
              ) : null}

              {resultFeedback && !failedResult ? (
                <ImportSuccessFeedbackBox
                  headline={
                    partialResult
                      ? `${importSummaryHeadline(resultFeedback.summary, entityLabel)} ${summarizeImportRowErrors(rowErrors)}`
                      : importSummaryHeadline(resultFeedback.summary, entityLabel)
                  }
                  partial={partialResult}
                />
              ) : null}

              {resultFeedback && failedResult ? (
                <ImportFatalFeedbackBox
                  feedback={{
                    kind: "fatal",
                    title: "Ninguna fila importada",
                    detail: [
                      importSummaryHeadline(resultFeedback.summary, entityLabel),
                      summarizeImportRowErrors(rowErrors),
                    ]
                      .filter(Boolean)
                      .join(" "),
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
