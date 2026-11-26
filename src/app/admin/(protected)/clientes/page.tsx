import { Suspense } from "react";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { CustomersAdminPanel } from "@/components/admin/customers-admin-panel";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { SkeletonAdminListBody } from "@/components/ui/skeleton";
import { getAdminClientesPageData } from "@/lib/admin-customers-data";
import { adminModuleChromeForPath } from "@/lib/admin-module-chrome";
import { requireStaffPermission } from "@/lib/session";

async function ClientesBody({ edit }: { edit: string | null }) {
  const { customers: rows, priceLists } = await getAdminClientesPageData();
  return (
    <>
      <ExcelSyncPanel
        exportUrl="/api/admin/customers/export"
        importUrl="/api/admin/customers/import"
        entityLabel="clientes"
      />
      <CustomersAdminPanel
        customers={rows}
        priceLists={priceLists}
        initialEditId={edit}
      />
    </>
  );
}

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireStaffPermission("customers");
  const { edit } = await searchParams;
  const chrome = adminModuleChromeForPath("/admin/clientes")!;

  return (
    <div className="space-y-6">
      <AdminModulePageHeader
        title={chrome.title}
        description={chrome.description}
      />
      <Suspense fallback={<SkeletonAdminListBody />}>
        <ClientesBody edit={edit ?? null} />
      </Suspense>
    </div>
  );
}
