import Link from "next/link";
import type { RochaSubscriptionStatus } from "@/lib/subscription-payments";

export function SubscriptionStatusSection({
  status,
  canViewPayments,
  canRegisterPayments,
}: {
  status: RochaSubscriptionStatus;
  canViewPayments?: boolean;
  canRegisterPayments?: boolean;
}) {
  const { current } = status;

  return (
    <section className="max-w-2xl rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Servicio
          </h2>
          <p className="text-sm text-neutral-600">
            Estado del abono mensual de la plataforma.
          </p>
        </div>
        {canViewPayments ? (
          <Link
            href="/admin/plataforma"
            className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {canRegisterPayments ? "Gestionar pagos" : "Ver pagos"}
          </Link>
        ) : null}
      </div>

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
      </div>
    </section>
  );
}
