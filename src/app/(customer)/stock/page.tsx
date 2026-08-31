import { notFound } from "next/navigation";
import {
  AdminStockReports,
  type StockReportEntry,
} from "@/components/admin/admin-stock-reports";
import { CustomerStockDateFilters } from "@/components/customer/customer-stock-date-filters";
import { CustomerStockPageHeader } from "@/components/customer/customer-stock-page-header";
import { CustomerStockTabs } from "@/components/customer/customer-stock-tabs";
import {
  loadActivosEntries,
  loadConsumiblesEntries,
  loadElaboradosEntries,
  STOCK_HISTORY_LIMIT,
} from "@/lib/admin-stock-data";
import { resolveStockDateRange } from "@/lib/admin-stock-summary-shared";
import {
  customerStockTabsForModules,
  parseCustomerStockTab,
} from "@/lib/customer-stock-shared";
import { requireCustomerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

async function loadCustomerStockEntries(
  tab: ReturnType<typeof parseCustomerStockTab>,
  from: string,
  to: string,
  customerId: string,
): Promise<StockReportEntry[]> {
  if (!tab) return [];
  if (tab.module === "CONSUMABLES") {
    return loadConsumiblesEntries(from, to, customerId, STOCK_HISTORY_LIMIT);
  }
  if (tab.module === "ACTIVOS") {
    return loadActivosEntries(from, to, customerId, STOCK_HISTORY_LIMIT);
  }
  return loadElaboradosEntries(from, to, customerId, STOCK_HISTORY_LIMIT);
}

export default async function CustomerStockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const [params, session] = await Promise.all([
    searchParams,
    requireCustomerSession(),
  ]);

  const modules = session.user.modules ?? [];
  const availableTabs = customerStockTabsForModules(modules);
  if (availableTabs.length === 0) {
    notFound();
  }

  const active = parseCustomerStockTab(params.tab, modules);
  if (!active) {
    notFound();
  }

  const { from, to } = resolveStockDateRange(params.from, params.to);
  const customerId = session.user.customerId!;
  const customerLabel = `${session.user.name ?? "Cliente"} · código ${session.user.customerCode ?? "—"}`;
  const entries = await loadCustomerStockEntries(active, from, to, customerId);

  const formCopy =
    active.tab === "consumibles"
      ? {
          formTitle: "Recuento de consumibles",
          formDescription:
            "Gaseosas, insumos y stock invertido. No son bajas del día.",
        }
      : active.tab === "activos"
        ? {
            formTitle: "Recuento de activos del local",
            formDescription:
              "Carritos, bandejas y otros activos. Podés elegir cualquier fecha.",
          }
        : {
            formTitle: "Carga de bajas del día",
            formDescription:
              "Recuento fin de día de panes y masas. Solo cantidades a tirar.",
          };

  const historialHint =
    active.tab === "consumibles"
      ? "Recuentos guardados (módulo Consumibles)."
      : active.tab === "activos"
        ? "Recuentos de activos guardados."
        : "Cargas de bajas del día guardadas.";

  return (
    <div className="space-y-6">
      <CustomerStockPageHeader
        title="Stock"
        description="Registrá y consultá tus cargas de stock."
        apiPath={`/api/customer/stock/${active.apiSegment}`}
        customerId={customerId}
        customerLabel={customerLabel}
        stockModule={active.stockModule}
        {...formCopy}
      />

      <CustomerStockTabs
        active={active.tab}
        tabs={availableTabs.map((row) => row.tab)}
        from={from}
        to={to}
      />

      <CustomerStockDateFilters tab={active.tab} from={from} to={to} />

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
            code: session.user.customerCode ?? "",
            name: session.user.name ?? "",
          },
        ]}
        customerId={customerId}
        kindLabel={
          active.tab === "consumibles"
            ? "Recuento"
            : active.tab === "activos"
              ? "Activo"
              : "Baja del día"
        }
        hideCustomerColumn
      />
    </div>
  );
}
