import Link from "next/link";
import { Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { whatsappUrl } from "@/lib/whatsapp";
import { CustomerAdminForm } from "@/components/admin/customer-admin-form";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { Badge } from "@/components/ui/badge";
import { DataTableScroll } from "@/components/ui/data-table";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string }>;
}) {
  const { q, edit } = await searchParams;
  const query = (q ?? "").trim();

  const [customers, priceListsRaw] = await Promise.all([
    db.customer.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { code: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { priceList: { select: { id: true, name: true } } },
      orderBy: { code: "asc" },
      take: 100,
    }),
    db.priceList.findMany({
      select: { id: true, name: true, active: true, excelKey: true },
    }),
  ]);

  const priceLists = sortPriceListsForDisplay(priceListsRaw).map(
    ({ id, name, active }) => ({ id, name, active }),
  );

  const editing = edit ? customers.find((c) => c.id === edit) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Clientes</h1>
        <p className="text-sm text-neutral-600">
          Asigná una lista de precios fijos. El cliente solo ve el precio final.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Buscar código o nombre…"
          className="h-10 flex-1 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-[var(--brand-primary)] px-4 text-sm text-white"
        >
          Buscar
        </button>
      </form>

      <ExcelSyncPanel
        exportUrl="/api/admin/customers/export"
        importUrl="/api/admin/customers/import"
        entityLabel="clientes"
      />

      <CustomerAdminForm
        key={editing?.id ?? "new"}
        priceLists={priceLists}
        customer={
          editing
            ? {
                id: editing.id,
                code: editing.code,
                name: editing.name,
                priceListId: editing.priceListId,
                address: editing.address,
                phone: editing.phone,
                email: editing.email,
                notes: editing.notes,
                paymentTerms: editing.paymentTerms,
                deliveryHours: editing.deliveryHours,
                active: editing.active,
              }
            : undefined
        }
      />

      <DataTableScroll>
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Dirección</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Lista</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const wa = c.phone ? whatsappUrl(c.phone) : null;
              return (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-mono">{c.code}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 text-neutral-700">
                    {c.address ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {c.phone && wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--brand-primary)] underline hover:opacity-80"
                      >
                        {c.phone}
                      </a>
                    ) : (
                      (c.phone ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.priceList?.name ?? "Minorista (base)"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={c.active ? "success" : "danger"}>
                      {c.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/clientes?edit=${c.id}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableScroll>
    </div>
  );
}
