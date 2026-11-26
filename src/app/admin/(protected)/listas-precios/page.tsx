import { Suspense } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { PriceListCreateForm } from "@/components/admin/price-list-create-form";
import { PriceListsTable } from "@/components/admin/price-lists-table";
import { SkeletonAdminPriceListsBody } from "@/components/ui/skeleton";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { getAdminPriceListsPageData } from "@/lib/admin-price-lists-data";
import { requireStaffPermission } from "@/lib/session";

async function ListasBody() {
  const lists = await getAdminPriceListsPageData();
  return (
    <>
      <PriceListCreateForm />
      <PriceListsTable lists={lists} />
    </>
  );
}

export default async function AdminListasPreciosPage() {
  await requireStaffPermission("priceLists");
  const chrome = adminModuleChromeForPath("/admin/listas-precios")!;

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={chrome.description}
      />
      <Suspense fallback={<SkeletonAdminPriceListsBody />}>
        <ListasBody />
      </Suspense>
    </div>
  );
}
