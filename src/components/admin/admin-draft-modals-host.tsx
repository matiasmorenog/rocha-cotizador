"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminNewQuoteModal } from "@/components/admin/admin-new-quote-modal";
import { CustomerAdminCreateModal } from "@/components/admin/customer-admin-create-modal";
import { ProductAdminForm } from "@/components/admin/product-admin-form";
import {
  StockRecountForm,
  type StockRecountCustomer,
} from "@/components/admin/stock-recount-form";
import {
  staffHasPermission,
  type StaffPermission,
} from "@/lib/staff-permissions";
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
    description:
      "Recuento fin de día de panes y masas por sucursal. Buscá productos y cargá cantidades a tirar.",
    apiPath: "/api/admin/desperdicios",
  },
  {
    module: "CONSUMABLES",
    title: "Recuento de consumibles",
    description:
      "Gaseosas, insumos y stock invertido por sucursal. No son desperdicios ni se «tiran» como pan del día.",
    apiPath: "/api/admin/consumibles",
  },
  {
    module: "ACTIVOS",
    title: "Recuento de activos del local",
    description:
      "Carritos, bandejas y otros activos del local. La fecha suele ser mensual pero podés elegir cualquier día.",
    apiPath: "/api/admin/activos",
  },
];

type PriceListOption = {
  id: string;
  name: string;
  active: boolean;
  isBase?: boolean;
};

/**
 * Lives in admin layout (outside RouteViewEnter) so open/minimized draft
 * modal cards stay mounted across module navigation.
 */
export function AdminDraftModalsHost({
  permissions,
  orderCutoffHourAr,
}: {
  permissions: readonly StaffPermission[];
  orderCutoffHourAr: number;
}) {
  const pathname = usePathname();
  const canStock = staffHasPermission(permissions, "stockReports");
  const canProducts = staffHasPermission(permissions, "products");
  const canCustomers = staffHasPermission(permissions, "customers");
  const canQuotes = staffHasPermission(permissions, "quotes");

  const productOpen = useModalDraftStore((s) => s.productCreate.open);
  const patchProductCreate = useModalDraftStore((s) => s.patchProductCreate);

  const customerOpen = useModalDraftStore((s) => s.customerCreate.open);
  const patchCustomerCreate = useModalDraftStore((s) => s.patchCustomerCreate);

  const [priceLists, setPriceLists] = useState<PriceListOption[]>([]);
  const [stockCustomers, setStockCustomers] = useState<StockRecountCustomer[]>(
    [],
  );

  useEffect(() => {
    if (!canCustomers) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/price-lists");
        const data = (await res.json().catch(() => ({}))) as {
          priceLists?: PriceListOption[];
        };
        if (!res.ok || cancelled) return;
        setPriceLists(data.priceLists ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canCustomers]);

  useEffect(() => {
    if (!canStock) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/customers");
        const data = (await res.json().catch(() => ({}))) as {
          customers?: Array<{ id: string; code: string; name: string }>;
        };
        if (!res.ok || cancelled) return;
        setStockCustomers(
          (data.customers ?? []).map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
          })),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canStock]);

  const onDeepLinkNueva = pathname.startsWith("/admin/cotizaciones/nueva");

  return (
    <>
      {canQuotes ? (
        <AdminNewQuoteModal
          orderCutoffHourAr={orderCutoffHourAr}
          suppressShell={onDeepLinkNueva}
        />
      ) : null}

      {canProducts ? (
        <ProductAdminForm
          rubros={[]}
          open={productOpen}
          onOpenChange={(open) => patchProductCreate({ open })}
        />
      ) : null}

      {canCustomers ? (
        <CustomerAdminCreateModal
          priceLists={priceLists}
          open={customerOpen}
          onOpenChange={(open) => patchCustomerCreate({ open })}
        />
      ) : null}

      {canStock
        ? STOCK_MODULES.map((cfg) => {
            const key = stockDraftKey("admin", cfg.module);
            return (
              <StockRecountFormHost
                key={key}
                draftKey={key}
                title={cfg.title}
                description={cfg.description}
                apiPath={cfg.apiPath}
                customers={stockCustomers}
                stockModule={cfg.module}
              />
            );
          })
        : null}
    </>
  );
}

function StockRecountFormHost({
  draftKey,
  title,
  description,
  apiPath,
  customers,
  stockModule,
}: {
  draftKey: string;
  title: string;
  description: string;
  apiPath: string;
  customers: StockRecountCustomer[];
  stockModule: StockModuleKey;
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
      open={open}
      onOpenChange={(v) => patchStock(draftKey, { open: v })}
    />
  );
}
