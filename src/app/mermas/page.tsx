import { notFound } from "next/navigation";
import { requireCustomerSession } from "@/lib/session";
import { customerHasModule } from "@/lib/customer-modules";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { StockCountForm } from "@/components/stock/stock-count-form";

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CustomerMermasPage() {
  const session = await requireCustomerSession();
  const customerId = session.user.customerId!;
  if (!(await customerHasModule(customerId, "MERMAS"))) {
    notFound();
  }

  const date = todayYmd();
  const entryDate = parseDateOnlyYmd(date);

  const [items, entry] = await Promise.all([
    db.stockItem.findMany({
      where: {
        active: true,
        kind: { in: ["RAW_MATERIAL", "BREAD"] },
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    entryDate
      ? db.mermaEntry.findUnique({
          where: { customerId_entryDate: { customerId, entryDate } },
          include: { lines: { select: { stockItemId: true, qty: true } } },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-2xl py-4">
      <StockCountForm
        apiPath="/api/mermas"
        title="Mermas"
        emptyHint="Registrá panes y materias primas descartadas al cierre."
        items={items.map((i) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          kind: i.kind,
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
