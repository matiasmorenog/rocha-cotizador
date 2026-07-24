import { db } from "@/lib/db";
import { ExcelSyncPanel } from "@/components/admin/excel-sync-panel";
import { CustomersAdminPanel } from "@/components/admin/customers-admin-panel";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;

  const [customers, priceListsRaw] = await Promise.all([
    db.customer.findMany({
      include: { priceList: { select: { id: true, name: true } } },
      orderBy: { code: "asc" },
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
