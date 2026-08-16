import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { StockCatalogPanel } from "@/components/admin/stock-catalog-panel";

export default async function AdminStockPage() {
  await requireStaffPermission("stockCatalog");

  const items = await db.stockItem.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      unit: true,
      active: true,
      sortOrder: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Catálogo de stock
        </h1>
        <p className="text-sm text-neutral-600">
          Ítems para mermas (pan / materia prima) y recuento de consumibles.
        </p>
      </div>
      <StockCatalogPanel items={items} />
    </div>
  );
}
