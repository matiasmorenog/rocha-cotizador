import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { ProductAdminTable } from "@/components/admin/product-admin-table";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export default async function AdminProductosPage() {
  await requireStaffPermission("products");
  const [products, priceLists] = await Promise.all([
    db.product.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        rubro: true,
        basePrice: true,
        active: true,
        allowsUnitOrder: true,
        priceListItems: {
          select: { priceListId: true, unitPrice: true },
        },
      },
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
    allowsUnitOrder: p.allowsUnitOrder,
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

      <ExcelSyncPanel
        exportUrl="/api/admin/products/export"
        importUrl="/api/admin/products/import"
        entityLabel="productos"
      />

      <ProductAdminTable products={tableRows} priceLists={orderedLists} />
    </div>
  );
}
