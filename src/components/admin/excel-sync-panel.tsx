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
  type ImportFeedback,
  type ImportValidationResult,
} from "@/lib/import-feedback";
import {
  ImportDuplicateWarningsBox,
  ImportFatalFeedbackBox,
  ImportFeedbackReveal,
  ImportRowErrorsBox,
  ImportSuccessFeedbackBox,
} from "@/components/admin/import-feedback-box";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { cn } from "@/lib/utils";

/** Same exit window as admin payment/customer form collapse. */
const PANEL_EXIT_MS = 250;

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

function parseAttachmentFilename(contentDisposition: string | null) {
  if (!contentDisposition) return null;
  const quoted = /filename="([^"]+)"/.exec(contentDisposition);
  if (quoted?.[1]) return quoted[1];
  const bare = /filename=([^;]+)/.exec(contentDisposition);
  return bare?.[1]?.trim() ?? null;
}

async function downloadExportFile(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = "No se pudo descargar el Excel.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) detail = data.error;
    } catch {
      // keep default detail
    }
    throw new Error(detail);
  }

  const blob = await res.blob();
  const filename =
    parseAttachmentFilename(res.headers.get("Content-Disposition")) ??
    "export.xlsx";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
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
  const {
    present: bodyPresent,
    exiting: bodyExiting,
    animKey: bodyAnimKey,
  } = useExitPresence(open, PANEL_EXIT_MS);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({
    status: "idle",
  });
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  async function onDownloadExport() {
    setDownloading(true);
    setImportFeedback(null);

    try {
      await downloadExportFile(exportUrl);
    } catch (err) {
      setValidation({
        status: "failed",
        feedback: {
          kind: "fatal",
          title: "Error al descargar",
          detail:
            err instanceof Error
              ? err.message
              : "No se pudo descargar el Excel.",
        },
      });
    } finally {
      setDownloading(false);
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
  const busy = validating || importing || downloading;
  const validated =
    validation.status === "validated" ? validation.result : null;
  const validationFailed =
    validation.status === "failed" ? validation.feedback : null;
  const canConfirm =
    validated?.ok === true && !importing && !validating && file != null;

  const validationFatalFeedback =
    validationFailed?.kind === "fatal" ? validationFailed : null;

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
          bodyPresent && "rounded-t-lg",
          !bodyPresent && "rounded-lg",
        )}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
            <FileSpreadsheet
              className="size-4 shrink-0 text-neutral-500"
              aria-hidden
            />
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

      <div
        className="grid transition-[grid-template-rows] duration-[250ms] ease-in"
        style={{
          gridTemplateRows: bodyPresent && !bodyExiting ? "1fr" : "0fr",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          {bodyPresent ? (
            <div
              id={panelId}
              key={bodyAnimKey}
              className={cn(
                "space-y-3 border-t border-neutral-100 px-4 pb-4 pt-3",
                bodyExiting ? "payment-form-exit" : "payment-form-enter",
              )}
            >
              <p className="text-xs text-neutral-500">
                Descargá la lista o subí un .xlsx. Primero validá el archivo;
                después confirmá la sincronización (upsert por código).
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
                    busy &&
                      "pointer-events-none cursor-not-allowed opacity-50",
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
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 gap-1.5"
                    disabled={busy}
                    onClick={() => void onDownloadExport()}
                  >
                    {downloading ? (
                      <>
                        <Spinner className="size-4" />
                        Descargando…
                      </>
                    ) : (
                      <>
                        <Download className="size-4 shrink-0" aria-hidden />
                        Descargar Excel
                      </>
                    )}
                  </Button>

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

              <ImportFeedbackReveal value={validationFatalFeedback}>
                {(fatal) => (
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <ImportFatalFeedbackBox feedback={fatal} />
                  </div>
                )}
              </ImportFeedbackReveal>

              <ImportFeedbackReveal value={validated}>
                {(result) => {
                  const errors = result.errors;
                  const warnings = result.warnings;
                  return (
                    <div className="space-y-2 border-t border-neutral-100 pt-3">
                      {result.ok ? (
                        <ImportSuccessFeedbackBox
                          headline={`Listo para importar ${result.rowCount} fila${result.rowCount === 1 ? "" : "s"}${result.skipped > 0 ? ` (${result.skipped} fila${result.skipped === 1 ? "" : "s"} vacía${result.skipped === 1 ? "" : "s"} omitida${result.skipped === 1 ? "" : "s"})` : ""}${warnings.length > 0 ? `. ${warnings.length} advertencia${warnings.length === 1 ? "" : "s"} de código duplicado` : ""}.`}
                          partial={false}
                          title={
                            warnings.length > 0
                              ? "Validación correcta con advertencias"
                              : "Validación correcta"
                          }
                        />
                      ) : (
                        <ImportRowErrorsBox
                          tone="error"
                          title="Validación con errores"
                          intro={`Corregí el Excel antes de sincronizar. ${result.rowCount} fila${result.rowCount === 1 ? "" : "s"} válida${result.rowCount === 1 ? "" : "s"}, ${errors.length} con error.`}
                          errors={errors}
                        />
                      )}

                      {warnings.length > 0 ? (
                        <ImportDuplicateWarningsBox warnings={warnings} />
                      ) : null}
                    </div>
                  );
                }}
              </ImportFeedbackReveal>

              <ImportFeedbackReveal value={importFeedback}>
                {(feedback) => {
                  const fatal =
                    feedback.kind === "fatal" ? feedback : null;
                  const result =
                    feedback.kind === "result" ? feedback : null;
                  const errors = result?.summary.errors ?? [];
                  const hasErrors = errors.length > 0;
                  const partial =
                    result != null &&
                    hasErrors &&
                    importHadMutations(result.summary);
                  const failed =
                    result != null &&
                    hasErrors &&
                    !importHadMutations(result.summary);

                  return (
                    <div className="space-y-2 border-t border-neutral-100 pt-3">
                      {fatal ? (
                        <ImportFatalFeedbackBox feedback={fatal} />
                      ) : null}

                      {result && !failed ? (
                        <>
                          <ImportSuccessFeedbackBox
                            headline={importSummaryHeadline(
                              result.summary,
                              entityLabel,
                            )}
                            partial={partial}
                          />
                          {partial && errors.length > 0 ? (
                            <ImportRowErrorsBox
                              tone="warning"
                              errors={errors}
                            />
                          ) : null}
                        </>
                      ) : null}

                      {result && failed ? (
                        <ImportRowErrorsBox
                          tone="error"
                          title="Ninguna fila importada"
                          intro={importSummaryHeadline(
                            result.summary,
                            entityLabel,
                          )}
                          errors={errors}
                        />
                      ) : null}
                    </div>
                  );
                }}
              </ImportFeedbackReveal>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
