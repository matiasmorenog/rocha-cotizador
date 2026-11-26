"use client";

import { Suspense, useCallback } from "react";
import { ClipboardPlus } from "lucide-react";
import { AdminNewQuoteForm } from "@/components/admin/admin-new-quote-form";
import {
  AdminDraftModal,
  AdminDraftModalBody,
  AdminDraftModalHeader,
  AdminDraftTrigger,
} from "@/components/ui/admin-draft-modal";
import { Button } from "@/components/ui/button";
import { useDraftSession } from "@/hooks/use-draft-session";
import { useQuoteDraftStore } from "@/stores/quote-draft-store";
import { useModalDraftStore } from "@/stores/modal-draft-store";

const TITLE_ID = "admin-new-quote-title";

export function AdminNewQuoteModal({
  orderCutoffHourAr,
  /** Hide shell on deep-link page — form renders inline there. */
  suppressShell = false,
}: {
  orderCutoffHourAr: number;
  suppressShell?: boolean;
}) {
  const open = useModalDraftStore((s) => s.adminNewQuote.open);
  const sessionActive = useModalDraftStore(
    (s) => s.adminNewQuote.sessionActive,
  );
  const customer = useModalDraftStore((s) => s.adminNewQuote.customer);
  const patchAdminNewQuote = useModalDraftStore((s) => s.patchAdminNewQuote);
  const clearAdminNewQuote = useModalDraftStore((s) => s.clearAdminNewQuote);
  const lines = useQuoteDraftStore((s) => s.lines);
  const clearLines = useQuoteDraftStore((s) => s.clear);

  const itemCount = lines.length + (customer ? 1 : 0);

  const setOpen = useCallback(
    (v: boolean) => {
      patchAdminNewQuote({ open: v });
    },
    [patchAdminNewQuote],
  );

  const {
    open: modalOpen,
    setOpen: setSessionOpen,
    minimize,
    endSession,
    showShell,
    showChip,
    exiting,
    animKey,
  } = useDraftSession({
    open,
    onOpenChange: setOpen,
    itemCount,
    sessionActive,
    onSessionActiveChange: (active) =>
      patchAdminNewQuote({ sessionActive: active }),
  });

  function discardDraft() {
    clearLines();
    clearAdminNewQuote();
    endSession();
  }

  const chipSubtitle = customer
    ? `${customer.code} · ${customer.name}${
        lines.length > 0
          ? ` · ${lines.length} ítem${lines.length === 1 ? "" : "s"}`
          : ""
      }`
    : lines.length > 0
      ? `${lines.length} ítem${lines.length === 1 ? "" : "s"}`
      : "Sin datos aún";

  if (suppressShell) return null;

  return (
    <AdminDraftModal
      open={modalOpen}
      showShell={showShell}
      showChip={showChip}
      exiting={exiting}
      animKey={animKey}
      labelledBy={TITLE_ID}
      onMinimize={minimize}
      onResume={() => setSessionOpen(true)}
      maxWidthClassName="max-w-5xl"
      chip={{
        title: "Cotización en curso",
        subtitle: chipSubtitle,
        icon: ClipboardPlus,
      }}
    >
      <div className="flex max-h-[min(90vh,56rem)] flex-col">
        <AdminDraftModalHeader
          titleId={TITLE_ID}
          title="Nueva cotización"
          description="Elegí un cliente y armá el remito. Podés minimizar y seguir en otro módulo."
        />
        <AdminDraftModalBody className="space-y-4">
          <Suspense
            fallback={<p className="text-sm text-neutral-500">Cargando…</p>}
          >
            <AdminNewQuoteForm orderCutoffHourAr={orderCutoffHourAr} />
          </Suspense>
          {sessionActive ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-3">
              <Button type="button" variant="outline" onClick={minimize}>
                Minimizar
              </Button>
              <Button type="button" variant="outline" onClick={discardDraft}>
                Descartar
              </Button>
            </div>
          ) : null}
        </AdminDraftModalBody>
      </div>
    </AdminDraftModal>
  );
}

export function AdminNewQuoteTrigger({
  pending = false,
  itemCount = 0,
  onClick,
}: {
  pending?: boolean;
  itemCount?: number;
  onClick: () => void;
}) {
  return (
    <AdminDraftTrigger
      onClick={onClick}
      pending={pending}
      itemCount={itemCount}
      idleLabel="Nueva cotización"
      pendingLabel="Continuar cotización"
      icon={ClipboardPlus}
    />
  );
}

export function useAdminNewQuoteTriggerState() {
  const open = useModalDraftStore((s) => s.adminNewQuote.open);
  const sessionActive = useModalDraftStore(
    (s) => s.adminNewQuote.sessionActive,
  );
  const customer = useModalDraftStore((s) => s.adminNewQuote.customer);
  const lines = useQuoteDraftStore((s) => s.lines);
  const patchAdminNewQuote = useModalDraftStore((s) => s.patchAdminNewQuote);
  const itemCount = lines.length + (customer ? 1 : 0);
  const pending = sessionActive && itemCount > 0;

  const toggle = useCallback(() => {
    const next = !useModalDraftStore.getState().adminNewQuote.open;
    patchAdminNewQuote({ open: next, ...(next ? { sessionActive: true } : {}) });
  }, [patchAdminNewQuote]);

  return { open, pending, itemCount, toggle };
}
