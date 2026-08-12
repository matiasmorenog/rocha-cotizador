"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

type ConnectionErrorPanelProps = {
  onRetry: () => void;
  backHref?: string;
  backLabel?: string;
};

/** Friendly fallback when a route fails (often DB / network). */
export function ConnectionErrorPanel({
  onRetry,
  backHref = "/",
  backLabel = "Volver al inicio",
}: ConnectionErrorPanelProps) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">
          No se pudo conectar
        </h2>
        <p className="text-sm text-neutral-600">
          Revisá tu conexión e intentá de nuevo. Si la red está bien, puede ser
          un corte temporal del servidor.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="primary" onClick={onRetry}>
          Reintentar
        </Button>
        <Link
          href={backHref}
          className={cn(
            "inline-flex h-10 items-center rounded-md border border-neutral-300 bg-white px-4 text-sm text-neutral-900 hover:bg-neutral-50",
            FOCUS_BRAND_BORDER,
          )}
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
