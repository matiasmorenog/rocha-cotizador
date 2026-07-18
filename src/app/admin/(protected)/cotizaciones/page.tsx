import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTableScroll } from "@/components/ui/data-table";
import { QuotesExportPanel } from "@/components/admin/quotes-export-panel";
import {
  ARGENTINA_TZ,
  resolveQuotesExportRange,
} from "@/lib/argentina-time";

export default async function AdminCotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const { q, from: fromParam, to: toParam } = await searchParams;
  const query = (q ?? "").trim();
  const { from, to, fromLocal, toLocal } = resolveQuotesExportRange(
    fromParam,
    toParam,
  );

  const quotes = await db.quote.findMany({
    where: {
      createdAt: { gte: from, lt: to },
      ...(query
        ? {
            OR: [
              { number: { contains: query, mode: "insensitive" as const } },
              {
                customer: {
                  name: { contains: query, mode: "insensitive" as const },
                },
              },
              {
                customer: {
                  code: { contains: query, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    },
    include: { customer: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Cotizaciones</h1>
        <Link
          href="/admin/cotizaciones/nueva"
          className="inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm text-white hover:opacity-90"
        >
          Nueva cotización
        </Link>
      </div>

      <QuotesExportPanel
        key={`${fromLocal}_${toLocal}`}
        defaultFromLocal={fromLocal}
        defaultToLocal={toLocal}
        searchQuery={query}
      />

      <form className="flex gap-2">
        <input type="hidden" name="from" value={fromLocal} />
        <input type="hidden" name="to" value={toLocal} />
        <input
          name="q"
          defaultValue={query}
          placeholder="Buscar número o cliente…"
          className="h-10 flex-1 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-[var(--brand-primary)] px-4 text-sm text-white"
        >
          Buscar
        </button>
      </form>

      <DataTableScroll>
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Número</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((qrow) => (
              <tr key={qrow.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">
                  <Link
                    href={`/remitos/${qrow.id}`}
                    className="font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    {qrow.number}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {qrow.customer.code} — {qrow.customer.name}
                </td>
                <td className="px-3 py-2">
                  {qrow.createdAt.toLocaleString("es-AR", {
                    timeZone: ARGENTINA_TZ,
                  })}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="success">{qrow.status}</Badge>
                </td>
                <td className="px-3 py-2 font-medium">{formatPrice(qrow.total)}</td>
              </tr>
            ))}
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  Sin cotizaciones en este rango
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </DataTableScroll>
    </div>
  );
}
