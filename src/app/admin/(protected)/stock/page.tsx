import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { StockCatalogPanel } from "@/components/admin/stock-catalog-panel";
import {
  serializeStockItem,
  stockItemListSelect,
} from "@/lib/stock-item-serialize";

export default async function AdminStockPage() {
  await requireStaffPermission("stockCatalog");

  const rows = await db.stockItem.findMany({
    orderBy: [
      { kind: "asc" },
      { sortOrder: "asc" },
      { product: { name: "asc" } },
    ],
    select: stockItemListSelect,
  });

  const items = rows.map(serializeStockItem);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Catálogo de stock
        </h1>
        <p className="text-sm text-neutral-600">
          Ítems del catálogo de productos para mermas (pan / materia prima) y
          recuento de consumibles. Buscá por código o nombre.
        </p>
      </div>
      <StockCatalogPanel items={items} />
    </div>
  );
}
