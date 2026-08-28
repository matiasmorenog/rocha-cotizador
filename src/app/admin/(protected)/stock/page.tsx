import { Suspense, type ReactNode } from "react";
import { requireStaffPermission } from "@/lib/session";
import { AdminStockReports } from "@/components/admin/admin-stock-reports";
import { AdminStockSummarySection } from "@/components/admin/admin-stock-summary-section";
import { StockPageHeader } from "@/components/admin/stock-page-header";
import { StockPanelFilters } from "@/components/admin/stock-panel-filters";
import { StockTabs } from "@/components/admin/stock-tabs";
import {
  loadActivosEntries,
  loadConsumiblesEntries,
  loadElaboradosEntries,
  moduleCustomers,
  parseStockTab,
  resolveStockCustomerId,
  STOCK_HISTORY_LIMIT,
  type StockModuleCustomer,
  type StockTab,
} from "@/lib/admin-stock-data";
import { resolveStockDateRange } from "@/lib/admin-stock-summary-shared";

function StockHistorialFallback() {
  return <p className="text-sm text-neutral-500">Cargando historial…</p>;
}

function StockPanel({
  tab,
  from,
  to,
  customerId,
  customers,
  children,
}: {
  tab: StockTab;
  from: string;
  to: string;
  customerId: string;
  customers: StockModuleCustomer[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <StockPanelFilters
        key={`${from}-${to}-${customerId}`}
        customers={customers}
        customerId={customerId}
        from={from}
        to={to}
        tab={tab}
      />

      <AdminStockSummarySection
        tab={tab}
        from={from}
        to={to}
        customerId={customerId}
      />

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Historial</h2>
        <p className="text-sm text-neutral-600">
          {tab === "consumibles"
            ? "Recuentos guardados por sucursal (módulo Consumibles)."
            : tab === "activos"
              ? "Recuentos de activos del local guardados por sucursal."
              : "Cargas de bajas del día guardadas por sucursal."}{" "}
          Hasta {STOCK_HISTORY_LIMIT} por consulta — filtrá por sucursal o
          fechas.
        </p>
      </div>
      {children}
    </div>
  );
}

async function StockHistorial({
  tab,
  from,
  to,
  customerId,
  customers,
}: {
  tab: StockTab;
  from: string;
  to: string;
  customerId: string;
  customers: StockModuleCustomer[];
}) {
  const entries =
    tab === "consumibles"
      ? await loadConsumiblesEntries(from, to, customerId || undefined)
      : tab === "activos"
        ? await loadActivosEntries(from, to, customerId || undefined)
        : await loadElaboradosEntries(from, to, customerId || undefined);

  return (
    <AdminStockReports
      entries={entries}
      customers={customers}
      customerId={customerId}
      kindLabel={
        tab === "consumibles"
          ? "Recuento"
          : tab === "activos"
            ? "Activo"
            : "Baja del día"
      }
    />
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
  const [params] = await Promise.all([
    searchParams,
    requireStaffPermission("stockReports"),
  ]);
  const tab: StockTab = parseStockTab(params.tab);
  const { from, to } = resolveStockDateRange(params.from, params.to);
  const stockModule =
    tab === "consumibles"
      ? "CONSUMABLES"
      : tab === "activos"
        ? "ACTIVOS"
        : "MERMAS";
  const customers = await moduleCustomers(stockModule);
  const customerId = resolveStockCustomerId(customers, params.customer);

  return (
    <div className="space-y-6">
      <StockPageHeader
        title="Stock"
        description="Bajas del día, consumibles y activos del local por sucursal."
        formTitle={
          tab === "consumibles"
            ? "Recuento de consumibles"
            : tab === "activos"
              ? "Recuento de activos del local"
              : "Carga de bajas del día"
        }
        formDescription={
          tab === "consumibles"
            ? "Gaseosas, insumos y stock invertido por sucursal. No son bajas del día ni se «tiran» como merma."
            : tab === "activos"
              ? "Carritos, bandejas y otros activos del local. La fecha suele ser mensual pero podés elegir cualquier día."
              : "Recuento fin de día de panes y masas por sucursal. Buscá productos y cargá cantidades a tirar."
        }
        apiPath={
          tab === "consumibles"
            ? "/api/admin/consumibles"
            : tab === "activos"
              ? "/api/admin/activos"
              : "/api/admin/mermas"
        }
        customers={customers}
        stockModule={stockModule}
      />

      <StockTabs active={tab} from={from} to={to} customerId={customerId} />

      <StockPanel
        tab={tab}
        from={from}
        to={to}
        customerId={customerId}
        customers={customers}
      >
        <Suspense fallback={<StockHistorialFallback />}>
          <StockHistorial
            tab={tab}
            from={from}
            to={to}
            customerId={customerId}
            customers={customers}
          />
        </Suspense>
      </StockPanel>
    </div>
  );
}
