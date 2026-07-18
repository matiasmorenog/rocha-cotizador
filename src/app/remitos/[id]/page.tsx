import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireCustomerSession, requireAdminSession } from "@/lib/session";
import { formatPrice, formatQty } from "@/lib/utils";
import { PrintButton } from "@/components/quote/print-button";
import { DataTableScroll } from "@/components/ui/data-table";

export default async function RemitoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  if (session.user.role === "CUSTOMER") {
    await requireCustomerSession();
  } else if (session.user.role === "ADMIN") {
    await requireAdminSession();
  } else {
    notFound();
  }

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          code: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          deliveryHours: true,
        },
      },
      items: { orderBy: { productCode: "asc" } },
    },
  });
  if (!quote) notFound();

  if (
    session.user.role === "CUSTOMER" &&
    quote.customerId !== session.user.customerId
  ) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Remito {quote.number}</h1>
          <p className="text-sm text-neutral-600">
            {quote.createdAt.toLocaleString("es-AR")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={session.user.role === "ADMIN" ? "/admin/cotizaciones" : "/remitos"}
            className="inline-flex h-10 items-center rounded-md border border-neutral-300 bg-white px-4 text-sm"
          >
            Volver
          </Link>
          <PrintButton />
        </div>
      </div>

      <article className="print-remito rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-primary)]">
              Rocha Cotizador
            </p>
            <h2 className="mt-1 text-xl font-semibold">Remito {quote.number}</h2>
            <p className="text-sm text-neutral-600">
              Fecha: {quote.createdAt.toLocaleDateString("es-AR")}
            </p>
          </div>
          <div className="text-sm text-neutral-800">
            <p className="font-semibold">
              {quote.customer.code} — {quote.customer.name}
            </p>
            {quote.customer.address ? <p>{quote.customer.address}</p> : null}
            {quote.customer.phone ? <p>Tel: {quote.customer.phone}</p> : null}
            {quote.customer.email ? <p>Email: {quote.customer.email}</p> : null}
            {quote.customer.deliveryHours ? (
              <p>Hs. entrega: {quote.customer.deliveryHours}</p>
            ) : null}
          </div>
        </header>

        <DataTableScroll className="rounded-none border-0 bg-transparent">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-neutral-600">
                <th className="py-2 pr-2 font-medium">Cód.</th>
                <th className="py-2 pr-2 font-medium">Cant.</th>
                <th className="py-2 pr-2 font-medium">Artículo</th>
                <th className="py-2 pr-2 text-right font-medium">Precio</th>
                <th className="py-2 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-2 font-mono text-xs">{item.productCode}</td>
                  <td className="py-2 pr-2">{formatQty(item.qty)}</td>
                  <td className="py-2 pr-2">{item.productName}</td>
                  <td className="py-2 pr-2 text-right">{formatPrice(item.unitPrice)}</td>
                  <td className="py-2 text-right font-medium">{formatPrice(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableScroll>

        <div className="mt-6 flex justify-end">
          <p className="text-lg font-semibold">
            Total: {formatPrice(quote.total)}
          </p>
        </div>
      </article>
    </div>
  );
}
