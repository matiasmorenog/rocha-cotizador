import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CustomerStockDateFilters } from "@/components/customer/customer-stock-date-filters";
import { CustomerStockHistoryLoader } from "@/components/customer/customer-stock-history-loader";
import { CustomerStockPageHeader } from "@/components/customer/customer-stock-page-header";
import { CustomerStockTabs } from "@/components/customer/customer-stock-tabs";
import { StockTabPanel } from "@/components/admin/stock-tab-panel";
import { SkeletonCustomerStockHistoryPanel } from "@/components/ui/skeleton";
import { resolveStockDateRange } from "@/lib/admin-stock-summary-shared";
import {
  customerStockTabLabel,
  customerStockTabsForModules,
  parseCustomerStockTab,
} from "@/lib/customer-stock-shared";
import { requireCustomerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CustomerStockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const [params, session] = await Promise.all([
    searchParams,
    requireCustomerSession(),
  ]);

  const customerId = session.user.customerId!;
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
  const customerLabel = `${session.user.name ?? "Cliente"} · código ${session.user.customerCode ?? "—"}`;

  const formCopy =
    active.tab === "consumibles"
      ? {
          formTitle: "Recuento de consumibles",
          formDescription:
            "Gaseosas, insumos y stock invertido. No son desperdicios.",
        }
      : active.tab === "activos"
        ? {
            formTitle: "Recuento de activos del local",
            formDescription:
              "Carritos, bandejas y otros activos. Podés elegir cualquier fecha.",
          }
        : {
            formTitle: "Carga de desperdicios",
            formDescription:
              "Recuento fin de día de panes y masas. Solo cantidades a tirar.",
          };

  const historialHint =
    active.tab === "consumibles"
      ? "Recuentos guardados (módulo Consumibles)."
      : active.tab === "activos"
        ? "Recuentos de activos guardados."
        : "Cargas de desperdicios guardadas.";

  const kindLabel =
    active.tab === "consumibles"
      ? "Recuento"
      : active.tab === "activos"
        ? "Activo del local"
        : "Desperdicio";

  return (
    <div className="space-y-6">
      <CustomerStockPageHeader
        title="Stock"
        description="Registrá y consultá tus cargas de stock."
        apiPath={`/api/customer/stock/${active.apiSegment}`}
        customerId={customerId}
        customerLabel={customerLabel}
        stockModule={active.stockModule}
        sectionLabel={
          availableTabs.length === 1
            ? customerStockTabLabel(active.tab)
            : undefined
        }
        {...formCopy}
      />

      <CustomerStockTabs
        active={active.tab}
        tabs={availableTabs.map((row) => row.tab)}
        from={from}
        to={to}
      />

      <StockTabPanel tabKey={active.tab}>
        <div className="space-y-6">
          <CustomerStockDateFilters tab={active.tab} from={from} to={to} />

          <Suspense fallback={<SkeletonCustomerStockHistoryPanel />}>
            <CustomerStockHistoryLoader
              tab={active.tab}
              from={from}
              to={to}
              customerId={customerId}
              customerCode={session.user.customerCode ?? ""}
              customerName={session.user.name ?? ""}
              historialHint={historialHint}
              kindLabel={kindLabel}
            />
          </Suspense>
        </div>
      </StockTabPanel>
    </div>
  );
}
