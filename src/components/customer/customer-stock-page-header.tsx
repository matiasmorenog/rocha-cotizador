"use client";

import { useCallback, useState } from "react";
import {
  StockRecountForm,
  StockRecountTrigger,
} from "@/components/admin/stock-recount-form";
import { SolapasTabLabel } from "@/components/ui/solapas-tabs";
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
  sectionLabel,
}: {
  title: string;
  description: string;
  formTitle: string;
  formDescription: string;
  apiPath: string;
  customerId: string;
  customerLabel: string;
  stockModule: StockModuleKey;
  /** Single stock module — chip beside title instead of a one-item tab bar. */
  sectionLabel?: string;
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
            {sectionLabel ? (
              <SolapasTabLabel>{sectionLabel}</SolapasTabLabel>
            ) : null}
          </div>
          <p className="text-sm text-neutral-600">{description}</p>
          <p className="mt-1 text-sm text-neutral-500">{customerLabel}</p>
        </div>
        <StockRecountTrigger
          pending={draft.pending}
          itemCount={draft.itemCount}
          onClick={() => setOpen((v) => !v)}
        />
      </div>

      <StockRecountForm
        key={stockModule}
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
        onDraftChange={onDraftChange}
      />
    </>
  );
}
