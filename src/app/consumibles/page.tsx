import { notFound } from "next/navigation";
import { requireCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { StockCountForm } from "@/components/stock/stock-count-form";
import {
  serializeStockItem,
  stockItemListSelect,
} from "@/lib/stock-item-serialize";
import { stockItemWhereForModule } from "@/lib/stock-rubros";

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CustomerConsumiblesPage() {
  const session = await requireCustomerSession();
  const customerId = session.user.customerId!;
  // Modules already on JWT — skip extra DB round-trip to Neon.
  if (!session.user.modules?.includes("CONSUMABLES")) {
    notFound();
  }

  const date = todayYmd();
  const entryDate = parseDateOnlyYmd(date);

  const [rows, entry] = await Promise.all([
    db.stockItem.findMany({
      where: stockItemWhereForModule("CONSUMABLES"),
      orderBy: [
        { product: { rubro: "asc" } },
        { sortOrder: "asc" },
        { product: { name: "asc" } },
      ],
      select: stockItemListSelect,
    }),
    entryDate
      ? db.consumableCount.findUnique({
          where: { customerId_entryDate: { customerId, entryDate } },
          select: {
            notes: true,
            lines: { select: { stockItemId: true, qty: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const items = rows.map(serializeStockItem);

  return (
    <div className="mx-auto max-w-2xl py-4">
      <StockCountForm
        apiPath="/api/consumibles"
        title="Consumibles"
        emptyHint="Cargá el recuento de stock de consumibles del día."
        items={items.map((i) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          rubro: i.rubro,
          unit: i.unit,
        }))}
        initialDate={date}
        initialEntry={
          entry
            ? {
                notes: entry.notes,
                lines: entry.lines.map((l) => ({
                  stockItemId: l.stockItemId,
                  qty: Number(l.qty),
                })),
              }
            : null
        }
      />
    </div>
  );
}
