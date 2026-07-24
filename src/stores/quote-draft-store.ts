"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuoteDraftLine = {
  productId: string;
  code: string;
  name: string;
  /** List/catalog unit price (kg). Ignored for totals when orderByUnit. */
  unitPrice: number;
  qty: number;
  /** Qty is unit count; effective price/line total = 0 until weighed. */
  orderByUnit: boolean;
  allowsUnitOrder: boolean;
};

export function effectiveUnitPrice(line: QuoteDraftLine): number {
  return line.orderByUnit ? 0 : line.unitPrice;
}

export function effectiveLineTotal(line: QuoteDraftLine): number {
  return effectiveUnitPrice(line) * line.qty;
}

type QuoteDraftState = {
  lines: QuoteDraftLine[];
  addOrUpdate: (
    line: Omit<QuoteDraftLine, "qty" | "orderByUnit" | "allowsUnitOrder"> & {
      qty?: number;
      orderByUnit?: boolean;
      allowsUnitOrder?: boolean;
    },
  ) => void;
  setQty: (productId: string, qty: number) => void;
  setOrderByUnit: (productId: string, orderByUnit: boolean) => void;
  remove: (productId: string) => void;
  clear: () => void;
  total: () => number;
};

export const useQuoteDraftStore = create<QuoteDraftState>()(
  persist(
    (set, get) => ({
      lines: [],
      addOrUpdate: (line) => {
        const qty = line.qty ?? 1;
        const orderByUnit = line.orderByUnit ?? false;
        const allowsUnitOrder = line.allowsUnitOrder ?? false;
        set((state) => {
          const existing = state.lines.find((l) => l.productId === line.productId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === line.productId
                  ? {
                      ...l,
                      qty: l.qty + qty,
                      unitPrice: line.unitPrice,
                      name: line.name,
                      orderByUnit,
                      allowsUnitOrder,
                    }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              {
                productId: line.productId,
                code: line.code,
                name: line.name,
                unitPrice: line.unitPrice,
                qty,
                orderByUnit,
                allowsUnitOrder,
              },
            ],
          };
        });
      },
      setQty: (productId, qty) => {
        if (qty <= 0) {
          get().remove(productId);
          return;
        }
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId ? { ...l, qty } : l,
          ),
        }));
      },
      setOrderByUnit: (productId, orderByUnit) => {
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId && l.allowsUnitOrder
              ? { ...l, orderByUnit }
              : l,
          ),
        }));
      },
      remove: (productId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.productId !== productId),
        })),
      clear: () => set({ lines: [] }),
      total: () =>
        get().lines.reduce((sum, l) => sum + effectiveLineTotal(l), 0),
    }),
    {
      name: "rocha-quote-draft",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { lines?: Array<Partial<QuoteDraftLine>> };
        return {
          lines: (state.lines ?? []).map((l) => ({
            productId: String(l.productId ?? ""),
            code: String(l.code ?? ""),
            name: String(l.name ?? ""),
            unitPrice: Number(l.unitPrice) || 0,
            qty: Number(l.qty) || 0,
            orderByUnit: Boolean(l.orderByUnit),
            allowsUnitOrder: Boolean(l.allowsUnitOrder),
          })),
        };
      },
    },
  ),
);
