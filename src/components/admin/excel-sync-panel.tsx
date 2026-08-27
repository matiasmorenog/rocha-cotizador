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
  type ImportFeedback,
} from "@/lib/import-feedback";
import {
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

export function ExcelSyncPanel({
  exportUrl,
  importUrl,
  entityLabel,
  broadcastCatalogStale = false,
}: ExcelSyncPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setFeedback({
        kind: "fatal",
        title: "Falta archivo",
        detail: "Elegí un archivo .xlsx antes de sincronizar.",
      });
      return;
    }
    setLoading(true);
    setFeedback(null);

    const body = new FormData();
    body.set("file", file);

    try {
      const res = await fetch(importUrl, { method: "POST", body });
      const parsed = await parseImportResponse(res, entityLabel);
      setFeedback(parsed);

      if (parsed.kind === "result") {
        const { summary } = parsed;
        const hadErrors = summary.errors.length > 0;
        const hadMutations = importHadMutations(summary);

        if (!hadErrors || hadMutations) {
          setFile(null);
          if (inputRef.current) inputRef.current.value = "";
        }
        if (hadMutations && broadcastCatalogStale) notifyCatalogStale();
        if (hadMutations) router.refresh();
      }
    } catch {
      setFeedback(importNetworkFatalMessage());
    } finally {
      setLoading(false);
    }
  }

  const resultFeedback = feedback?.kind === "result" ? feedback : null;
  const fatalFeedback = feedback?.kind === "fatal" ? feedback : null;
  const rowErrors = resultFeedback?.summary.errors ?? [];
  const hasRowErrors = rowErrors.length > 0;
  const partialResult =
    resultFeedback != null && hasRowErrors && importHadMutations(resultFeedback.summary);
  const failedResult =
    resultFeedback != null && hasRowErrors && !importHadMutations(resultFeedback.summary);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1 md:max-w-sm">
          <p className="text-sm font-medium text-neutral-900">Excel</p>
          <p className="text-xs text-neutral-500">
            Descargá la lista o subí un .xlsx para sincronizar (upsert por código).
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[18rem]">
          <a
            href={exportUrl}
            className={cn(
              "inline-flex h-10 w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50 sm:w-auto",
              FOCUS_BRAND_BORDER,
            )}
          >
            Descargar Excel
          </a>

          <form
            onSubmit={onImport}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              Elegir archivo
            </Button>
            <span
              className="min-w-0 flex-1 truncate text-sm text-neutral-500 sm:max-w-[10rem]"
              title={file?.name}
            >
              {file?.name ?? "Ningún archivo"}
            </span>
            <Button
              type="submit"
              variant="secondary"
              className="w-full shrink-0 sm:w-auto"
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <Spinner className="mr-2" />
                  Subiendo…
                </>
              ) : (
                "Sincronizar"
              )}
            </Button>
          </form>
        </div>
      </div>

      {feedback ? (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          {fatalFeedback ? <ImportFatalFeedbackBox feedback={fatalFeedback} /> : null}

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
