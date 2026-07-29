"use client";

import { useState } from "react";
import { QuoteBuilder } from "@/components/quote/quote-builder";
import {
  CustomerPicker,
  type PickedCustomer,
} from "@/components/admin/customer-picker";
import { useQuoteDraftStore } from "@/stores/quote-draft-store";

export function AdminNewQuoteForm() {
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const clearDraft = useQuoteDraftStore((s) => s.clear);

  function handleCustomerChange(next: PickedCustomer | null) {
    clearDraft();
    setCustomer(next);
  }

  return (
    <div className="space-y-6">
      <CustomerPicker value={customer} onChange={handleCustomerChange} />
      {customer ? (
        <QuoteBuilder key={customer.id} customerId={customer.id} />
      ) : (
        <p className="text-sm text-neutral-500">
          Elegí un cliente para armar la cotización con sus precios.
        </p>
      )}
    </div>
  );
}
