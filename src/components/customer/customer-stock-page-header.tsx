"use client";

import { useState } from "react";
import {
  StockRecountForm,
  StockRecountTrigger,
} from "@/components/admin/stock-recount-form";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";

export function CustomerStockPageHeader({
  title,
  description,
  formTitle,
  formDescription,
  apiPath,
  customerId,
  customerLabel,
  stockModule,
}: {
  title: string;
  description: string;
  formTitle: string;
  formDescription: string;
  apiPath: string;
  customerId: string;
  customerLabel: string;
  stockModule: StockModuleKey;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          <p className="text-sm text-neutral-600">{description}</p>
          <p className="mt-1 text-sm text-neutral-500">{customerLabel}</p>
        </div>
        <StockRecountTrigger onClick={() => setOpen((v) => !v)} />
      </div>

      <StockRecountForm
        title={formTitle}
        description={formDescription}
        apiPath={apiPath}
        customers={[{ id: customerId, code: "", name: customerLabel }]}
        stockModule={stockModule}
        fixedCustomerId={customerId}
        refreshAdminSummary={false}
        customerStockModule={stockModule}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
