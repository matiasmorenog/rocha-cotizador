"use client";

import { create } from "zustand";
import {
  DEFAULT_CUSTOMER_MODULE_FLAGS,
  type CustomerModuleFlags,
} from "@/lib/customer-modules";
import { DEFAULT_PRODUCT_STOCK_KIND } from "@/lib/stock-product-kind-labels";
import type {
  ProductStockKindValue,
  StockModuleKey,
} from "@/lib/stock-product-kind-shared";
import type { ProductMeasureUnit } from "@/lib/stock-units";
import { toArgentinaDatetimeLocal } from "@/lib/argentina-time";

export type StockRecountLineDraft = {
  productId: string;
  code: string;
  name: string;
  rubro: string | null;
  allowsUnitOrder: boolean;
  unit: ProductMeasureUnit;
  qty: number;
};

export type StockRecountDraft = {
  open: boolean;
  sessionActive: boolean;
  customerId: string;
  dateValue: string;
  notes: string;
  lines: StockRecountLineDraft[];
  /** After restore/navigate, skip one API entry hydrate so draft lines survive. */
  skipEntryLoad: boolean;
};

export type ProductCreateDraft = {
  open: boolean;
  sessionActive: boolean;
  code: string;
  name: string;
  rubro: string;
  basePrice: string;
  available: boolean;
  stockKind: ProductStockKindValue;
  allowsUnitOrder: boolean;
};

export type CustomerCreateDraft = {
  open: boolean;
  sessionActive: boolean;
  code: string;
  name: string;
  nameNote: string;
  priceListId: string;
  address: string;
  phone: string;
  email: string;
  paymentTerms: string;
  deliveryHours: string;
  notes: string;
  active: boolean;
  modules: CustomerModuleFlags;
};

export type StockDraftScope = "admin" | "customer";

export function stockDraftKey(
  scope: StockDraftScope,
  stockModule: StockModuleKey,
): string {
  return `${scope}:${stockModule}`;
}

function todayDateValue(): string {
  return `${toArgentinaDatetimeLocal(new Date()).slice(0, 10)}T00:00`;
}

export function emptyStockRecountDraft(
  customerId = "",
): StockRecountDraft {
  return {
    open: false,
    sessionActive: false,
    customerId,
    dateValue: todayDateValue(),
    notes: "",
    lines: [],
    skipEntryLoad: false,
  };
}

export function emptyProductCreateDraft(): ProductCreateDraft {
  return {
    open: false,
    sessionActive: false,
    code: "",
    name: "",
    rubro: "",
    basePrice: "",
    available: true,
    stockKind: DEFAULT_PRODUCT_STOCK_KIND,
    allowsUnitOrder: false,
  };
}

export function emptyCustomerCreateDraft(
  priceListId = "",
): CustomerCreateDraft {
  return {
    open: false,
    sessionActive: false,
    code: "",
    name: "",
    nameNote: "",
    priceListId,
    address: "",
    phone: "",
    email: "",
    paymentTerms: "",
    deliveryHours: "",
    notes: "",
    active: true,
    modules: { ...DEFAULT_CUSTOMER_MODULE_FLAGS },
  };
}

/** Admin “Nueva cotización” modal — lines live in quote-draft-store. */
export type AdminNewQuoteCustomer = {
  id: string;
  code: string;
  name: string;
  nameNote: string | null;
  priceListName: string | null;
  active: boolean;
};

export type AdminNewQuoteDraft = {
  open: boolean;
  sessionActive: boolean;
  customer: AdminNewQuoteCustomer | null;
  /** Bump to re-focus customer search after confirm-create-new. */
  focusSearchToken: number;
};

export function emptyAdminNewQuoteDraft(): AdminNewQuoteDraft {
  return {
    open: false,
    sessionActive: false,
    customer: null,
    focusSearchToken: 0,
  };
}

type ModalDraftState = {
  stock: Record<string, StockRecountDraft>;
  productCreate: ProductCreateDraft;
  customerCreate: CustomerCreateDraft;
  adminNewQuote: AdminNewQuoteDraft;

  getStock: (key: string) => StockRecountDraft;
  patchStock: (key: string, patch: Partial<StockRecountDraft>) => void;
  clearStock: (key: string, customerId?: string) => void;

  patchProductCreate: (patch: Partial<ProductCreateDraft>) => void;
  clearProductCreate: () => void;

  patchCustomerCreate: (patch: Partial<CustomerCreateDraft>) => void;
  clearCustomerCreate: (priceListId?: string) => void;

  patchAdminNewQuote: (patch: Partial<AdminNewQuoteDraft>) => void;
  clearAdminNewQuote: () => void;
};

export const useModalDraftStore = create<ModalDraftState>((set, get) => ({
  stock: {},
  productCreate: emptyProductCreateDraft(),
  customerCreate: emptyCustomerCreateDraft(),
  adminNewQuote: emptyAdminNewQuoteDraft(),

  getStock: (key) => get().stock[key] ?? emptyStockRecountDraft(),

  patchStock: (key, patch) =>
    set((state) => {
      const prev = state.stock[key] ?? emptyStockRecountDraft();
      return {
        stock: {
          ...state.stock,
          [key]: { ...prev, ...patch },
        },
      };
    }),

  clearStock: (key, customerId = "") =>
    set((state) => ({
      stock: {
        ...state.stock,
        [key]: emptyStockRecountDraft(customerId),
      },
    })),

  patchProductCreate: (patch) =>
    set((state) => ({
      productCreate: { ...state.productCreate, ...patch },
    })),

  clearProductCreate: () =>
    set({ productCreate: emptyProductCreateDraft() }),

  patchCustomerCreate: (patch) =>
    set((state) => ({
      customerCreate: { ...state.customerCreate, ...patch },
    })),

  clearCustomerCreate: (priceListId = "") =>
    set({ customerCreate: emptyCustomerCreateDraft(priceListId) }),

  patchAdminNewQuote: (patch) =>
    set((state) => ({
      adminNewQuote: { ...state.adminNewQuote, ...patch },
    })),

  clearAdminNewQuote: () =>
    set({ adminNewQuote: emptyAdminNewQuoteDraft() }),
}));
