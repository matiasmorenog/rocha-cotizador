import type { RochaSubscriptionStatus } from "@/lib/subscription-payments";

export function SubscriptionStatusSection({
  status,
}: {
  status: RochaSubscriptionStatus;
}) {
  const { current, recentPaid } = status;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Servicio
      </h2>
      <p className="mb-4 text-sm text-neutral-600">
        Estado del abono mensual de la plataforma.
      </p>

      <div className="space-y-3 text-sm">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
          <p className="font-semibold text-neutral-900">{current.periodLabel}</p>
          <p className="mt-1 text-neutral-700">
            {current.paid ? "Pagado" : "Pendiente"}
            {current.paid && current.paidAtLabel
              ? ` · ${current.paidAtLabel}`
              : null}
          </p>
          {!current.paid ? (
            <p className="mt-2 text-neutral-600">
              El período actual aún no figura como pagado. El cotizador sigue
              disponible.
            </p>
          ) : null}
        </div>

        {recentPaid.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Últimos pagos
            </p>
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
              {recentPaid.map((row) => (
                <li
                  key={`${row.periodYear}-${row.periodMonth}`}
                  className="flex items-baseline justify-between gap-3 px-3 py-2"
                >
                  <span className="text-neutral-800">{row.periodLabel}</span>
                  <span className="text-neutral-600">
                    Pagado
                    {row.paidAtLabel ? ` · ${row.paidAtLabel}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-neutral-500">No hay pagos anteriores registrados.</p>
        )}
      </div>
    </section>
  );
}
