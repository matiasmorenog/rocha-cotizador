"use client";

import { useMemo } from "react";
import {
  StockRecountForm,
  type StockRecountCustomer,
} from "@/components/admin/stock-recount-form";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import {
  stockDraftKey,
  useModalDraftStore,
} from "@/stores/modal-draft-store";

const STOCK_MODULES: Array<{
  module: StockModuleKey;
  title: string;
  description: string;
  apiPath: string;
}> = [
  {
    module: "DESPERDICIOS",
    title: "Carga de desperdicios",
    description: "Recuento fin de día de panes y masas.",
    apiPath: "/api/customer/stock/desperdicios",
  },
  {
    module: "CONSUMABLES",
    title: "Recuento de consumibles",
    description: "Insumos y stock invertido.",
    apiPath: "/api/customer/stock/consumibles",
  },
  {
    module: "ACTIVOS",
    title: "Recuento de activos del local",
    description: "Carritos, bandejas y otros activos.",
    apiPath: "/api/customer/stock/activos",
  },
];

/**
 * Customer layout host — stock recount modals stay mounted across /stock tabs
 * and other customer module routes.
 */
export function CustomerDraftModalsHost({
  customerId,
  customerLabel,
  modules,
}: {
  customerId: string;
  customerLabel: string;
  modules: StockModuleKey[];
}) {
  const allowed = useMemo(() => new Set(modules), [modules]);
  const customers: StockRecountCustomer[] = useMemo(
    () => [{ id: customerId, code: "", name: customerLabel }],
    [customerId, customerLabel],
  );

  return (
    <>
      {STOCK_MODULES.filter((cfg) => allowed.has(cfg.module)).map((cfg) => {
        const key = stockDraftKey("customer", cfg.module);
        return (
          <CustomerStockRecountHost
            key={key}
            draftKey={key}
            title={cfg.title}
            description={cfg.description}
            apiPath={cfg.apiPath}
            customers={customers}
            stockModule={cfg.module}
            customerId={customerId}
          />
        );
      })}
    </>
  );
}

function CustomerStockRecountHost({
  draftKey,
  title,
  description,
  apiPath,
  customers,
  stockModule,
  customerId,
}: {
  draftKey: string;
  title: string;
  description: string;
  apiPath: string;
  customers: StockRecountCustomer[];
  stockModule: StockModuleKey;
  customerId: string;
}) {
  const open = useModalDraftStore((s) => s.stock[draftKey]?.open ?? false);
  const patchStock = useModalDraftStore((s) => s.patchStock);

  return (
    <StockRecountForm
      draftKey={draftKey}
      title={title}
      description={description}
      apiPath={apiPath}
      customers={customers}
      stockModule={stockModule}
      fixedCustomerId={customerId}
      refreshAdminSummary={false}
      customerStockModule={stockModule}
      open={open}
      onOpenChange={(v) => patchStock(draftKey, { open: v })}
    />
  );
}
