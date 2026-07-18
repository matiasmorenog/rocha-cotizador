import Link from "next/link";
import { AdminNewQuoteForm } from "@/components/admin/admin-new-quote-form";

export default function AdminNuevaCotizacionPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Nueva cotización
          </h1>
          <p className="text-sm text-neutral-600">
            Armá una cotización en nombre de un cliente.
          </p>
        </div>
        <Link
          href="/admin/cotizaciones"
          className="text-sm text-[var(--brand-primary)] hover:underline"
        >
          Volver al listado
        </Link>
      </div>
      <AdminNewQuoteForm />
    </div>
  );
}
