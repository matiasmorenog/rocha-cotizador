import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { CustomerModulesPanel } from "@/components/admin/customer-modules-panel";

export default async function AdminModulosPage() {
  await requireStaffPermission("customerModules");

  const customers = await db.customer.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      active: true,
      moduleAccess: { select: { module: true, enabled: true } },
    },
  });

  const rows = customers.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    active: c.active,
    modules: {
      MERMAS: Boolean(
        c.moduleAccess.find((m) => m.module === "MERMAS" && m.enabled),
      ),
      CONSUMABLES: Boolean(
        c.moduleAccess.find((m) => m.module === "CONSUMABLES" && m.enabled),
      ),
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Módulos</h1>
        <p className="text-sm text-neutral-600">
          Habilitá Mermas y Consumibles por cliente / sucursal.
        </p>
      </div>
      <CustomerModulesPanel customers={rows} />
    </div>
  );
}
