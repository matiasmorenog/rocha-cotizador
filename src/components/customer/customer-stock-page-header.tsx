"use client";

import { useCallback } from "react";
import { StockRecountTrigger } from "@/components/admin/stock-recount-form";
import { SolapasTabLabel } from "@/components/ui/solapas-tabs";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import {
  stockDraftKey,
  useModalDraftStore,
} from "@/stores/modal-draft-store";

/** Trigger-only header — form shell lives in CustomerDraftModalsHost. */
export function CustomerStockPageHeader({
  title,
  description,
  customerLabel,
  stockModule,
  sectionLabel,
}: {
  title: string;
  description: string;
  customerLabel: string;
  stockModule: StockModuleKey;
  /** Single stock module — chip beside title instead of a one-item tab bar. */
  sectionLabel?: string;
  /** Call-site compat; ignored (host owns the form). */
  formTitle?: string;
  formDescription?: string;
  apiPath?: string;
  customerId?: string;
}) {
  const draftKey = stockDraftKey("customer", stockModule);
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
        pending={pending}
        itemCount={itemCount}
        onClick={() => setOpen(!open)}
      />
    </div>
  );
}
