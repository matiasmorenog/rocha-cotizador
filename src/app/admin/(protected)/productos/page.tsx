import { requireStaffPermission } from "@/lib/session";
import { getAdminProductosPageData } from "@/lib/admin-products-data";
import { ProductAdminTable } from "@/components/admin/product-admin-table";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";

export default async function AdminProductosPage() {
  await requireStaffPermission("products");
  const { products: tableRows, priceLists: orderedLists, rubros } =
    await getAdminProductosPageData();

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
        broadcastCatalogStale
      />

      <ProductAdminTable
        products={tableRows}
        priceLists={orderedLists}
        rubros={rubros}
      />
    </div>
  );
}
