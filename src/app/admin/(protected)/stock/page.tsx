import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { StockCatalogPanel } from "@/components/admin/stock-catalog-panel";
import {
  serializeStockItem,
  stockItemListSelect,
} from "@/lib/stock-item-serialize";
import { listDistinctProductRubros } from "@/lib/stock-rubros";

export default async function AdminStockPage() {
  await requireStaffPermission("stockCatalog");

  const [rows, rubros] = await Promise.all([
    db.stockItem.findMany({
      orderBy: [
        { product: { rubro: "asc" } },
        { sortOrder: "asc" },
        { product: { name: "asc" } },
      ],
      select: stockItemListSelect,
    }),
    listDistinctProductRubros(),
  ]);

  const items = rows.map(serializeStockItem);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Catálogo de stock
        </h1>
        <p className="text-sm text-neutral-600">
          Productos del catálogo para mermas y consumibles. Tipo = rubro del
          producto. Buscá por código o nombre.
        </p>
      </div>
      <StockCatalogPanel items={items} rubros={rubros} />
    </div>
  );
}
