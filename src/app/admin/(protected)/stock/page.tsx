import { requireStaffPermission } from "@/lib/session";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { AdminStockReports } from "@/components/admin/admin-stock-reports";
import { StockRecountForm } from "@/components/admin/stock-recount-form";
import { StockTabs } from "@/components/admin/stock-tabs";
import {
  loadConsumiblesEntries,
  loadElaboradosEntries,
  moduleCustomers,
  parseStockTab,
  resolveStockCustomerId,
  STOCK_HISTORY_LIMIT,
  type StockTab,
} from "@/lib/admin-stock-data";

async function ElaboradosPanel({
  from,
  to,
  customerId,
  customers,
}: {
  from: string;
  to: string;
  customerId: string;
  customers: Awaited<ReturnType<typeof moduleCustomers>>;
}) {
  const entries = await loadElaboradosEntries(from, to, customerId || undefined);

  return (
    <div className="space-y-8">
      <StockRecountForm
        title="Carga de elaborados"
        description="Recuento fin de día de panes y masas por sucursal. Buscá productos y cargá cantidades a tirar."
        apiPath="/api/admin/mermas"
        customers={customers}
        stockModule="MERMAS"
      />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Historial</h2>
          <p className="text-sm text-neutral-600">
            Cargas guardadas por sucursal (módulo Elaborados). Hasta{" "}
            {STOCK_HISTORY_LIMIT} por consulta — filtrá por sucursal o fechas.
          </p>
        </div>
        <AdminStockReports
          entries={entries}
          customers={customers}
          customerId={customerId}
          kindLabel="Elaborado"
          from={from}
          to={to}
          tab="elaborados"
        />
      </div>
    </div>
  );
}

async function ConsumiblesPanel({
  from,
  to,
  customerId,
  customers,
}: {
  from: string;
  to: string;
  customerId: string;
  customers: Awaited<ReturnType<typeof moduleCustomers>>;
}) {
  const entries = await loadConsumiblesEntries(
    from,
    to,
    customerId || undefined,
  );

  return (
    <div className="space-y-8">
      <StockRecountForm
        title="Recuento de consumibles"
        description="Stock invertido (gaseosas, insumos, etc.) por sucursal. No son elaborados diarios."
        apiPath="/api/admin/consumibles"
        customers={customers}
        stockModule="CONSUMABLES"
      />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Historial</h2>
          <p className="text-sm text-neutral-600">
            Recuentos guardados por sucursal (módulo Consumibles). Hasta{" "}
            {STOCK_HISTORY_LIMIT} por consulta — filtrá por sucursal o fechas.
          </p>
        </div>
        <AdminStockReports
          entries={entries}
          customers={customers}
          customerId={customerId}
          kindLabel="Recuento"
          from={from}
          to={to}
          tab="consumibles"
        />
      </div>
    </div>
  );
}

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    customer?: string;
  }>;
}) {
  await requireStaffPermission("stockReports");
  const {
    tab: tabParam,
    from: fromParam,
    to: toParam,
    customer: customerParam,
  } = await searchParams;
  const tab: StockTab = parseStockTab(tabParam);
  const from = fromParam && parseDateOnlyYmd(fromParam) ? fromParam : "";
  const to = toParam && parseDateOnlyYmd(toParam) ? toParam : "";
  const stockModule = tab === "consumibles" ? "CONSUMABLES" : "MERMAS";
  const customers = await moduleCustomers(stockModule);
  const customerId = resolveStockCustomerId(customers, customerParam);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Stock</h1>
        <p className="text-sm text-neutral-600">
          Elaborados y consumibles por sucursal.
        </p>
      </div>

      <StockTabs active={tab} from={from} to={to} customerId={customerId} />

      {tab === "consumibles" ? (
        <ConsumiblesPanel
          from={from}
          to={to}
          customerId={customerId}
          customers={customers}
        />
      ) : (
        <ElaboradosPanel
          from={from}
          to={to}
          customerId={customerId}
          customers={customers}
        />
      )}
    </div>
  );
}
