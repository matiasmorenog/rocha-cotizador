import {
  AdminStockReports,
  type StockReportEntry,
} from "@/components/admin/admin-stock-reports";
import {
  loadActivosEntries,
  loadConsumiblesEntries,
  loadDesperdiciosEntries,
  STOCK_HISTORY_LIMIT,
  type StockTab,
} from "@/lib/admin-stock-data";
type Props = {
  tab: StockTab;
  from: string;
  to: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  historialHint: string;
  kindLabel: string;
};

async function loadEntries(
  tab: StockTab,
  from: string,
  to: string,
  customerId: string,
): Promise<StockReportEntry[]> {
  if (tab === "consumibles") {
    return loadConsumiblesEntries(from, to, customerId, STOCK_HISTORY_LIMIT);
  }
  if (tab === "activos") {
    return loadActivosEntries(from, to, customerId, STOCK_HISTORY_LIMIT);
  }
  return loadDesperdiciosEntries(from, to, customerId, STOCK_HISTORY_LIMIT);
}

/** Async historial segment — one stock query, streamed after header/tabs. */
export async function CustomerStockHistoryLoader({
  tab,
  from,
  to,
  customerId,
  customerCode,
  customerName,
  historialHint,
  kindLabel,
}: Props) {
  const entries = await loadEntries(tab, from, to, customerId);

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Historial</h2>
        <p className="text-sm text-neutral-600">
          {historialHint} Hasta {STOCK_HISTORY_LIMIT} por consulta — filtrá por
          fechas.
        </p>
      </div>

      <AdminStockReports
        entries={entries}
        customers={[
          {
            id: customerId,
            code: customerCode,
            name: customerName,
          },
        ]}
        customerId={customerId}
        kindLabel={kindLabel}
        hideCustomerColumn
      />
    </>
  );
}
