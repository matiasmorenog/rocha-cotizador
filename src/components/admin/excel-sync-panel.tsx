"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { notifyCatalogStale } from "@/lib/client-catalog-cache";
import { cn } from "@/lib/utils";

type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Elegí un archivo .xlsx");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    const body = new FormData();
    body.set("file", file);

    const res = await fetch(importUrl, { method: "POST", body });
    setLoading(false);
    const data = (await res.json().catch(() => ({}))) as ImportSummary & {
      error?: string;
    };

    if (!res.ok) {
      setError(data.error ?? "Error al importar");
      return;
    }

    const errCount = data.errors?.length ?? 0;
    const parts = [
      `Creados: ${data.created}`,
      `actualizados: ${data.updated}`,
      `omitidos: ${data.skipped}`,
    ];
    if (errCount > 0) {
      parts.push(`errores: ${errCount}`);
      const sample = data.errors
        .slice(0, 5)
        .map((x) => `fila ${x.row}: ${x.message}`)
        .join("; ");
      setError(sample + (errCount > 5 ? "…" : ""));
    }
    setMessage(`Sincronización ${entityLabel}: ${parts.join(", ")}`);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    if (broadcastCatalogStale) notifyCatalogStale();
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
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
              "inline-flex h-10 w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 sm:w-auto",
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

      {(message || error) && (
        <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
          {message && <p className="text-green-700">{message}</p>}
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
