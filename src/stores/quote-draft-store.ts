"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuoteDraftLine = {
  productId: string;
  code: string;
  name: string;
  unitPrice: number;
  qty: number;
};

type QuoteDraftState = {
  lines: QuoteDraftLine[];
  addOrUpdate: (line: Omit<QuoteDraftLine, "qty"> & { qty?: number }) => void;
  setQty: (productId: string, qty: number) => void;
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
        set((state) => {
          const existing = state.lines.find((l) => l.productId === line.productId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === line.productId
                  ? { ...l, qty: l.qty + qty, unitPrice: line.unitPrice, name: line.name }
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
      remove: (productId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.productId !== productId),
        })),
      clear: () => set({ lines: [] }),
      total: () =>
        get().lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
    }),
    { name: "rocha-quote-draft" },
  ),
);
