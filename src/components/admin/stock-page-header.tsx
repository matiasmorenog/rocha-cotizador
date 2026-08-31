"use client";

import { useState } from "react";
import { StockRecountForm, StockRecountTrigger } from "./stock-recount-form";
import type { StockRecountCustomer } from "./stock-recount-form";

export function StockPageHeader({
  title,
  description,
  formTitle,
  formDescription,
  apiPath,
  customers,
  stockModule,
}: {
  title: string;
  description: string;
  formTitle: string;
  formDescription: string;
  apiPath: string;
  customers: StockRecountCustomer[];
  stockModule: "DESPERDICIOS" | "CONSUMABLES" | "ACTIVOS";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          <p className="text-sm text-neutral-600">{description}</p>
        </div>
        <StockRecountTrigger onClick={() => setOpen((v) => !v)} />
      </div>

      <StockRecountForm
        title={formTitle}
        description={formDescription}
        apiPath={apiPath}
        customers={customers}
        stockModule={stockModule}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
