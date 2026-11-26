"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuoteBuilder } from "@/components/quote/quote-builder";
import {
  CustomerPicker,
  type PickedCustomer,
} from "@/components/admin/customer-picker";
import { useQuoteDraftStore } from "@/stores/quote-draft-store";
import { useModalDraftStore } from "@/stores/modal-draft-store";

/** Keep in sync with `.quote-panel-exit` duration in globals.css */
const QUOTE_CUSTOMER_EXIT_MS = 200;

export function AdminNewQuoteForm({
  orderCutoffHourAr,
}: {
  orderCutoffHourAr: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customer = useModalDraftStore((s) => s.adminNewQuote.customer);
  const focusSearchToken = useModalDraftStore(
    (s) => s.adminNewQuote.focusSearchToken,
  );
  const patchAdminNewQuote = useModalDraftStore((s) => s.patchAdminNewQuote);
  const clearDraft = useQuoteDraftStore((s) => s.clear);

  const [exiting, setExiting] = useState(false);
  const exitGenRef = useRef(0);
  /** When exit finishes, also bump focusSearchToken (confirm-create-new). */
  const focusSearchAfterExitRef = useRef(false);

  function finishCustomerExit() {
    clearDraft();
    const token =
      useModalDraftStore.getState().adminNewQuote.focusSearchToken;
    patchAdminNewQuote({
      customer: null,
      ...(focusSearchAfterExitRef.current
        ? { focusSearchToken: token + 1 }
        : {}),
    });
    focusSearchAfterExitRef.current = false;
    setExiting(false);
  }

  /** Same fade/slide as “Cambiar cliente”; optional focus search after. */
  function beginCustomerExit(options?: { focusSearch?: boolean }) {
    if (!customer || exiting) return;
    focusSearchAfterExitRef.current = options?.focusSearch === true;
    setExiting(true);
  }

  // Soft nav to ?focus=customer (fallback when no onConfirmCreateNew) — clear + focus.
  useEffect(() => {
    if (searchParams.get("focus") !== "customer") return;
    const t = window.setTimeout(() => {
      exitGenRef.current += 1;
      focusSearchAfterExitRef.current = false;
      clearDraft();
      setExiting(false);
      patchAdminNewQuote({
        customer: null,
        focusSearchToken:
          useModalDraftStore.getState().adminNewQuote.focusSearchToken + 1,
      });
      router.replace("/admin/cotizaciones/nueva", { scroll: false });
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to focus query
  }, [searchParams]);

  useEffect(() => {
    if (!exiting) return;

    const gen = ++exitGenRef.current;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : QUOTE_CUSTOMER_EXIT_MS + 40;
    const t = window.setTimeout(() => {
      if (gen !== exitGenRef.current) return;
      finishCustomerExit();
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish closes over latest refs
  }, [exiting, clearDraft]);

  function handleCustomerChange(next: PickedCustomer | null) {
    if (next === null) {
      beginCustomerExit();
      return;
    }
    exitGenRef.current += 1;
    focusSearchAfterExitRef.current = false;
    clearDraft();
    setExiting(false);
    patchAdminNewQuote({ customer: next });
  }

  return (
    <div className="space-y-6">
      <CustomerPicker
        value={customer}
        exiting={exiting}
        onChange={handleCustomerChange}
        autoFocusSearch={focusSearchToken > 0}
        focusToken={focusSearchToken}
      />
      {customer ? (
        <QuoteBuilder
          key={customer.id}
          customerId={customer.id}
          exiting={exiting}
          onConfirmCreateNew={() => beginCustomerExit({ focusSearch: true })}
          orderCutoffHourAr={orderCutoffHourAr}
        />
      ) : (
        <p className="text-sm text-neutral-500">
          Elegí un cliente para armar la cotización con sus precios.
        </p>
      )}
    </div>
  );
}
