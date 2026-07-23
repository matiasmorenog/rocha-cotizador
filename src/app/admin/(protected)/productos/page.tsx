import Link from "next/link";
import { Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { ProductAdminForm } from "@/components/admin/product-admin-form";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTableScroll } from "@/components/ui/data-table";

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string }>;
}) {
  const { q, edit } = await searchParams;
  const query = (q ?? "").trim();

  const [products, priceLists] = await Promise.all([
    db.product.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { code: { contains: query, mode: "insensitive" } },
              { rubro: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        priceListItems: {
          select: { priceListId: true, unitPrice: true },
        },
      },
      orderBy: { code: "asc" },
      take: 100,
    }),
    db.priceList.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true },
    }),
  ]);

  const editing = edit ? products.find((p) => p.id === edit) : undefined;
  const editingListPrices = editing
    ? Object.fromEntries(
        editing.priceListItems.map((i) => [i.priceListId, Number(i.unitPrice)]),
      )
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
        <p className="text-sm text-neutral-600">
          Mayorista = precio base. Podés editar también los precios de cada lista.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Buscar código, nombre o rubro…"
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
        exportUrl="/api/admin/products/export"
        importUrl="/api/admin/products/import"
        entityLabel="productos"
      />

      <ProductAdminForm
        key={editing?.id ?? "new"}
        priceLists={priceLists}
        product={
          editing
            ? {
                id: editing.id,
                code: editing.code,
                name: editing.name,
                rubro: editing.rubro,
                basePrice: Number(editing.basePrice),
                active: editing.active,
                listPrices: editingListPrices,
              }
            : undefined
        }
      />

      <DataTableScroll>
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Rubro</th>
              <th className="px-3 py-2">Mayorista</th>
              {priceLists
                .filter((l) => l.active)
                .map((l) => (
                  <th key={l.id} className="px-3 py-2 whitespace-nowrap">
                    {l.name}
                  </th>
                ))}
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const byList = new Map(
                p.priceListItems.map((i) => [i.priceListId, Number(i.unitPrice)]),
              );
              return (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-mono">{p.code}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-neutral-600">{p.rubro}</td>
                  <td className="px-3 py-2">{formatPrice(p.basePrice)}</td>
                  {priceLists
                    .filter((l) => l.active)
                    .map((l) => {
                      const price = byList.get(l.id);
                      return (
                        <td key={l.id} className="px-3 py-2 text-neutral-700">
                          {price != null ? formatPrice(price) : "—"}
                        </td>
                      );
                    })}
                  <td className="px-3 py-2">
                    <Badge variant={p.active ? "success" : "danger"}>
                      {p.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/productos?edit=${p.id}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
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
