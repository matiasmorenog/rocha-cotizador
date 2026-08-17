import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { AdminStockReports } from "@/components/admin/admin-stock-reports";
import { StockRecountForm } from "@/components/admin/stock-recount-form";
import {
  serializeStockLine,
  stockLineSelect,
} from "@/lib/stock-line-serialize";

async function moduleCustomers(module: "MERMAS" | "CONSUMABLES") {
  return db.customer.findMany({
    where: {
      active: true,
      moduleAccess: { some: { module, enabled: true } },
    },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export default async function AdminMermasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireStaffPermission("stockReports");
  const { from: fromParam, to: toParam } = await searchParams;
  const from = fromParam && parseDateOnlyYmd(fromParam) ? fromParam : "";
  const to = toParam && parseDateOnlyYmd(toParam) ? toParam : "";
  const fromDate = from ? parseDateOnlyYmd(from) : null;
  const toDate = to ? parseDateOnlyYmd(to) : null;

  const [customers, rows] = await Promise.all([
    moduleCustomers("MERMAS"),
    db.mermaEntry.findMany({
      where:
        fromDate || toDate
          ? {
              entryDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : undefined,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        entryDate: true,
        notes: true,
        submittedBy: true,
        customer: { select: { code: true, name: true } },
        lines: { select: stockLineSelect },
      },
    }),
  ]);

  const entries = rows.map((e) => ({
    id: e.id,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    notes: e.notes,
    submittedBy: e.submittedBy,
    customer: e.customer,
    lines: e.lines.map(serializeStockLine),
  }));

  return (
    <div className="space-y-8">
      <StockRecountForm
        title="Carga de mermas"
        description="Recuento fin de día de panes y masas por sucursal. Buscá productos y cargá cantidades a tirar."
        apiPath="/api/admin/mermas"
        customers={customers}
        stockModule="MERMAS"
      />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Historial</h2>
          <p className="text-sm text-neutral-600">
            Cargas guardadas por sucursal (módulo Mermas).
          </p>
        </div>
        <AdminStockReports
          entries={entries}
          kindLabel="Merma"
          from={from}
          to={to}
        />
      </div>
    </div>
  );
}
