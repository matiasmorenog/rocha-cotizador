"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuoteBuilder } from "@/components/quote/quote-builder";
import {
  CustomerPicker,
  type PickedCustomer,
} from "@/components/admin/customer-picker";
import { useQuoteDraftStore } from "@/stores/quote-draft-store";

/** Keep in sync with `.quote-panel-exit` duration in globals.css */
const QUOTE_CUSTOMER_EXIT_MS = 200;

export function AdminNewQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [exiting, setExiting] = useState(false);
  /** Bumps so CustomerPicker re-focuses after each “crear nuevo remito”. */
  const [focusSearchToken, setFocusSearchToken] = useState(0);
  const clearDraft = useQuoteDraftStore((s) => s.clear);
  const exitGenRef = useRef(0);

  function clearCustomerAndFocusSearch() {
    exitGenRef.current += 1;
    clearDraft();
    setExiting(false);
    setCustomer(null);
    setFocusSearchToken((n) => n + 1);
  }

  // Soft nav to ?focus=customer (same page) — clear chip + focus search.
  // Defer setState: avoid sync setState-in-effect lint; primary path uses callback.
  useEffect(() => {
    if (searchParams.get("focus") !== "customer") return;
    const t = window.setTimeout(() => {
      clearCustomerAndFocusSearch();
      router.replace("/admin/cotizaciones/nueva", { scroll: false });
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to focus query
  }, [searchParams]);

  useEffect(() => {
    if (!exiting) return;

    const finish = () => {
      clearDraft();
      setCustomer(null);
      setExiting(false);
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish();
      return;
    }

    const gen = ++exitGenRef.current;
    const t = window.setTimeout(() => {
      if (gen !== exitGenRef.current) return;
      finish();
    }, QUOTE_CUSTOMER_EXIT_MS + 40);
    return () => window.clearTimeout(t);
  }, [exiting, clearDraft]);

  function handleCustomerChange(next: PickedCustomer | null) {
    if (next === null) {
      if (!customer || exiting) return;
      setExiting(true);
      return;
    }
    exitGenRef.current += 1;
    clearDraft();
    setExiting(false);
    setCustomer(next);
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
          onConfirmCreateNew={clearCustomerAndFocusSearch}
        />
      ) : (
        <p className="text-sm text-neutral-500">
          Elegí un cliente para armar la cotización con sus precios.
        </p>
      )}
    </div>
  );
}
