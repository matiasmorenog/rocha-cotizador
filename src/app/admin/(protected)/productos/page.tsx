import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { ProductAdminTable } from "@/components/admin/product-admin-table";
import { SkeletonAdminListBody } from "@/components/ui/skeleton";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { getAdminProductosPageData } from "@/lib/admin-products-data";
import { requireStaffPermission } from "@/lib/session";

async function ProductosBody() {
  const { products: tableRows, priceLists: orderedLists, rubros } =
    await getAdminProductosPageData();
  return (
    <>
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
    </>
  );
}

export default async function AdminProductosPage() {
  await requireStaffPermission("products");
  const chrome = adminModuleChromeForPath("/admin/productos")!;

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={chrome.description}
      />
      <Suspense fallback={<SkeletonAdminListBody />}>
        <ProductosBody />
      </Suspense>
    </div>
  );
}
