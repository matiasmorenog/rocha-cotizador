"use client";

import { useCallback } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { StockRecountForm, StockRecountTrigger } from "./stock-recount-form";
import type { StockRecountCustomer } from "./stock-recount-form";
import {
  stockDraftKey,
  useModalDraftStore,
} from "@/stores/modal-draft-store";

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
  const draftKey = stockDraftKey("admin", stockModule);
  const open = useModalDraftStore((s) => s.stock[draftKey]?.open ?? false);
  const sessionActive = useModalDraftStore(
    (s) => s.stock[draftKey]?.sessionActive ?? false,
  );
  const itemCount = useModalDraftStore(
    (s) => s.stock[draftKey]?.lines.length ?? 0,
  );
  const pending = sessionActive && itemCount > 0;
  const patchStock = useModalDraftStore((s) => s.patchStock);

  const setOpen = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const prev = useModalDraftStore.getState().stock[draftKey]?.open ?? false;
      const next = typeof v === "function" ? v(prev) : v;
      patchStock(draftKey, { open: next });
    },
    [draftKey, patchStock],
  );

  return (
    <>
      <AdminModulePageHeader
        title={title}
        description={description}
        titleClassName="text-xl font-semibold text-neutral-900"
        actions={
          <StockRecountTrigger
            pending={pending}
            itemCount={itemCount}
            onClick={() => setOpen((v) => !v)}
          />
        }
      />

      <StockRecountForm
        key={stockModule}
        draftKey={draftKey}
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
