import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { CustomersAdminPanel } from "@/components/admin/customers-admin-panel";
import { sortPriceListsForDisplay } from "@/lib/pricing";
import { modulesFromAccess } from "@/lib/customer-modules";

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireStaffPermission("customers");
  const { edit } = await searchParams;

  const [customers, priceListsRaw] = await Promise.all([
    db.customer.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        priceListId: true,
        priceList: { select: { id: true, name: true } },
        address: true,
        phone: true,
        email: true,
        notes: true,
        paymentTerms: true,
        deliveryHours: true,
        active: true,
        moduleAccess: { select: { module: true, enabled: true } },
      },
    }),
    db.priceList.findMany({
      select: { id: true, name: true, active: true, excelKey: true, isBase: true },
    }),
  ]);

  const priceLists = sortPriceListsForDisplay(priceListsRaw).map(
    ({ id, name, active, isBase }) => ({ id, name, active, isBase }),
  );

  const rows = customers.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    priceListId: c.priceListId,
    priceListName: c.priceList?.name ?? null,
    address: c.address,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    paymentTerms: c.paymentTerms,
    deliveryHours: c.deliveryHours,
    active: c.active,
    modules: modulesFromAccess(c.moduleAccess),
  }));

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
