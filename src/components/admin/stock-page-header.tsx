"use client";

import { useCallback } from "react";
import { AdminModulePageHeader } from "@/components/admin/admin-module-page-header";
import { StockRecountTrigger } from "./stock-recount-form";
import {
  stockDraftKey,
  useModalDraftStore,
} from "@/stores/modal-draft-store";

export function StockPageHeader({
  title,
  description,
  stockModule,
}: {
  title: string;
  description: string;
  /** @deprecated form props live in AdminDraftModalsHost */
  formTitle?: string;
  formDescription?: string;
  apiPath?: string;
  customers?: unknown;
  stockModule: "DESPERDICIOS" | "CONSUMABLES" | "ACTIVOS";
}) {
  const draftKey = stockDraftKey("admin", stockModule);
  const sessionActive = useModalDraftStore(
    (s) => s.stock[draftKey]?.sessionActive ?? false,
  );
  const itemCount = useModalDraftStore(
    (s) => s.stock[draftKey]?.lines.length ?? 0,
  );
  const pending = sessionActive && itemCount > 0;
  const patchStock = useModalDraftStore((s) => s.patchStock);

  const toggleOpen = useCallback(() => {
    const prev = useModalDraftStore.getState().stock[draftKey]?.open ?? false;
    patchStock(draftKey, { open: !prev });
  }, [draftKey, patchStock]);

  return (
    <AdminModulePageHeader
      title={title}
      description={description}
      titleClassName="text-xl font-semibold text-neutral-900"
      actions={
        <StockRecountTrigger
          pending={pending}
          itemCount={itemCount}
          onClick={toggleOpen}
        />
      }
    />
  );
}
