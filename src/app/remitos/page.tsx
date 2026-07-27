import Link from "next/link";
import { requireCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { quoteStatusLabel } from "@/lib/quote-status";
import { DataTableScroll } from "@/components/ui/data-table";

/** Always hit DB — never serve a statically cached remitos list after deletes/wipes. */
export const dynamic = "force-dynamic";

export default async function RemitosPage() {
  const session = await requireCustomerSession();
  const quotes = await db.quote.findMany({
    where: { customerId: session.user.customerId! },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Mis remitos</h1>
      <DataTableScroll>
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Número</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                  Todavía no hay cotizaciones.
                </td>
              </tr>
            ) : (
              quotes.map((q) => (
                <tr key={q.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <Link href={`/remitos/${q.id}`} className="font-medium text-[var(--brand-primary)] hover:underline">
                      {q.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {q.createdAt.toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="success">{quoteStatusLabel(q.status)}</Badge>
                  </td>
                  <td className="px-3 py-2 font-medium">{formatPrice(q.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableScroll>
    </div>
  );
}
