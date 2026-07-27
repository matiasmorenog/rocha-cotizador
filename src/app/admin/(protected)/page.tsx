import Link from "next/link";
import { getAdminDashboardData } from "@/lib/admin-dashboard-cache";
import { formatPrice } from "@/lib/utils";

/** Dynamic shell; dashboard payload uses tagged Data Cache (TTL 5m, bust on quote create). */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { customers, products, quotesToday, recent } = await getAdminDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <Link
          href="/admin/cotizaciones/nueva"
          className="inline-flex h-10 items-center rounded-md bg-[var(--brand-primary)] px-4 text-sm text-white hover:opacity-90"
        >
          Nueva cotización
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Clientes activos", value: customers },
          { label: "Productos activos", value: products },
          { label: "Cotizaciones hoy", value: quotesToday },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-500">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="font-medium text-neutral-900">Últimas cotizaciones</h2>
          <Link href="/admin/cotizaciones" className="text-sm text-[var(--brand-primary)]">
            Ver todas
          </Link>
        </div>
        <ul className="divide-y divide-neutral-100 text-sm">
          {recent.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/remitos/${q.id}`} className="font-medium hover:underline">
                  {q.number}
                </Link>
                <p className="text-neutral-500">
                  {q.customer.code} — {q.customer.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatPrice(q.total)}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(q.createdAt).toLocaleString("es-AR")}
                </p>
              </div>
            </li>
          ))}
          {recent.length === 0 ? (
            <li className="px-4 py-8 text-center text-neutral-500">Sin cotizaciones aún</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
