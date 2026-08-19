import { requireStaffPermission } from "@/lib/session";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { CustomersAdminPanel } from "@/components/admin/customers-admin-panel";
import { getAdminClientesPageData } from "@/lib/admin-customers-data";

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireStaffPermission("customers");
  const { edit } = await searchParams;

  const { customers: rows, priceLists } = await getAdminClientesPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Clientes</h1>
        <p className="text-sm text-neutral-600">
          Asigná una lista de precios fijos. El cliente solo ve el precio final.
        </p>
      </div>

      <ExcelSyncPanel
        exportUrl="/api/admin/customers/export"
        importUrl="/api/admin/customers/import"
        entityLabel="clientes"
      />

      <CustomersAdminPanel
        customers={rows}
        priceLists={priceLists}
        initialEditId={edit ?? null}
      />
    </div>
  );
}
