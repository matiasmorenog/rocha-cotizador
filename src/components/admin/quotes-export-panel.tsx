"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

type QuotesExportPanelProps = {
  defaultFromLocal: string;
  defaultToLocal: string;
  searchQuery?: string;
};

export function QuotesExportPanel({
  defaultFromLocal,
  defaultToLocal,
  searchQuery = "",
}: QuotesExportPanelProps) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFromLocal);
  const [to, setTo] = useState(defaultToLocal);

  function buildParams() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }

  function onFilter(e: FormEvent) {
    e.preventDefault();
    const params = buildParams();
    if (searchQuery) params.set("q", searchQuery);
    router.push(`/admin/cotizaciones?${params.toString()}`);
  }

  function onDownload() {
    const params = buildParams();
    window.location.href = `/api/admin/quotes/export?${params.toString()}`;
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <form onSubmit={onFilter} className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-900">
            Exportar cotizaciones
          </p>
          <p className="text-xs text-neutral-500">
            Por defecto: ayer 16:00 → hoy 16:00.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-600">
            Desde
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-600">
            Hasta
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50 sm:w-auto"
          >
            Filtrar lista
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:opacity-90 sm:w-auto"
          >
            Descargar PDF
          </button>
        </div>
      </form>
    </div>
  );
}
