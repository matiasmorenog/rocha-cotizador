import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { AdminStockReports } from "@/components/admin/admin-stock-reports";

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

  const rows = await db.mermaEntry.findMany({
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
    include: {
      customer: { select: { code: true, name: true } },
      lines: {
        include: {
          stockItem: {
            select: { code: true, name: true, kind: true, unit: true },
          },
        },
      },
    },
  });

  const entries = rows.map((e) => ({
    id: e.id,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    notes: e.notes,
    submittedBy: e.submittedBy,
    customer: e.customer,
    lines: e.lines.map((l) => ({
      stockItemId: l.stockItemId,
      qty: Number(l.qty),
      stockItem: l.stockItem,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Mermas</h1>
        <p className="text-sm text-neutral-600">
          Cargas de merma enviadas por clientes con el módulo habilitado.
        </p>
      </div>
      <AdminStockReports
        entries={entries}
        kindLabel="Merma"
        from={from}
        to={to}
      />
    </div>
  );
}
