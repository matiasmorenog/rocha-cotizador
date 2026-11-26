"use client";

import { useCallback, useState } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
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
  const [draft, setDraft] = useState({ pending: false, itemCount: 0 });
  const onDraftChange = useCallback(
    (next: { pending: boolean; itemCount: number }) => {
      setDraft(next);
    },
    [],
  );

  return (
    <>
      <AdminModulePageHeader
        title={title}
        description={description}
        titleClassName="text-xl font-semibold text-neutral-900"
        actions={
          <StockRecountTrigger
            pending={draft.pending}
            itemCount={draft.itemCount}
            onClick={() => setOpen((v) => !v)}
          />
        }
      />

      <StockRecountForm
        key={stockModule}
        title={formTitle}
        description={formDescription}
        apiPath={apiPath}
        customers={customers}
        stockModule={stockModule}
        open={open}
        onOpenChange={setOpen}
        onDraftChange={onDraftChange}
      />
    </>
  );
}
