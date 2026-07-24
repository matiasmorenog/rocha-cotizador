import { db } from "@/lib/db";
import { ProductAdminForm } from "@/components/admin/product-admin-form";
import { ProductAdminTable } from "@/components/admin/product-admin-table";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
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
      select: { id: true, name: true, active: true, excelKey: true, isBase: true },
    }),
  ]);

  const orderedLists = sortPriceListsForDisplay(priceLists)
    .filter((l) => !l.isBase)
    .map(({ id, name, active }) => ({ id, name, active }));

  const tableRows = products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    rubro: p.rubro,
    basePrice: Number(p.basePrice),
    active: p.active,
    listPrices: Object.fromEntries(
      p.priceListItems.map((i) => [i.priceListId, Number(i.unitPrice)]),
    ),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
        <p className="text-sm text-neutral-600">
          Precio base = lista Precio base (también editable en Listas). Al crear
          solo pedimos base; precios por lista de dto se editan en la tabla o con
          “Rellenar desde…”.
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

      <ProductAdminForm />

      <ProductAdminTable products={tableRows} priceLists={orderedLists} />
    </div>
  );
}
