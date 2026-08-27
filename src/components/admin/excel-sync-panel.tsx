"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  ImportRowErrorsBox,
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

export function ExcelSyncPanel({
  exportUrl,
  importUrl,
  entityLabel,
  broadcastCatalogStale = false,
}: ExcelSyncPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
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
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0 space-y-1 md:max-w-sm">
          <p className="text-sm font-medium text-neutral-900">Excel</p>
          <p className="text-xs text-neutral-500">
            Descargá la lista o subí un .xlsx. Primero validá el archivo; después
            confirmá la sincronización (upsert por código).
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 sm:w-[22rem] sm:shrink-0">
          <a
            href={exportUrl}
            className={cn(
              "inline-flex h-10 w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50",
              FOCUS_BRAND_BORDER,
            )}
          >
            Descargar Excel
          </a>

          <div className="space-y-3 border-t border-neutral-100 pt-4">
            <p className="text-xs font-medium text-neutral-600">
              Importar / sincronizar
            </p>

            <form onSubmit={onValidate} className="flex flex-col gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(ev) => onFileChange(ev.target.files?.[0] ?? null)}
              />

              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                >
                  Elegir archivo
                </Button>
                <span
                  className="min-w-0 flex-1 truncate text-sm text-neutral-500"
                  title={file?.name}
                >
                  {file?.name ?? "Ningún archivo"}
                </span>
              </div>

              <Button
                type="submit"
                variant="secondary"
                className="h-10 w-full"
                disabled={busy || !file}
              >
                {validating ? (
                  <>
                    <Spinner className="mr-2" />
                    Validando…
                  </>
                ) : (
                  "Validar archivo"
                )}
              </Button>
            </form>

            <Button
              type="button"
              variant="primary"
              className="h-10 w-full"
              disabled={!canConfirm}
              onClick={() => void onConfirmImport()}
            >
              {importing ? (
                <>
                  <Spinner className="mr-2" />
                  Sincronizando…
                </>
              ) : (
                "Confirmar sincronización"
              )}
            </Button>
          </div>
        </div>
      </div>

      {validationFatalFeedback ? (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          <ImportFatalFeedbackBox feedback={validationFatalFeedback} />
        </div>
      ) : null}

      {validated ? (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
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
                detail: `Corregí el Excel antes de sincronizar. ${validated.rowCount} fila${validated.rowCount === 1 ? "" : "s"} válida${validated.rowCount === 1 ? "" : "s"}, ${validationErrors.length} con error.`,
              }}
            />
          )}

          {validationErrors.length > 0 ? (
            <ImportRowErrorsBox errors={validationErrors} tone="error" />
          ) : null}

          {validationWarnings.length > 0 ? (
            <ImportDuplicateWarningsBox warnings={validationWarnings} />
          ) : null}
        </div>
      ) : null}

      {importFeedback ? (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          {importFatalFeedback ? (
            <ImportFatalFeedbackBox feedback={importFatalFeedback} />
          ) : null}

          {resultFeedback && !failedResult ? (
            <ImportSuccessFeedbackBox
              headline={importSummaryHeadline(resultFeedback.summary, entityLabel)}
              partial={partialResult}
            />
          ) : null}

          {resultFeedback && failedResult ? (
            <ImportFatalFeedbackBox
              feedback={{
                kind: "fatal",
                title: "Ninguna fila importada",
                detail: importSummaryHeadline(resultFeedback.summary, entityLabel),
              }}
            />
          ) : null}

          {hasRowErrors ? (
            <ImportRowErrorsBox errors={rowErrors} tone={failedResult ? "error" : "warning"} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
