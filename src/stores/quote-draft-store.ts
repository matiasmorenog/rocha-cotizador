"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuoteDraftLine = {
  /** Client-side line id — same product may appear twice (kg + units). */
  id: string;
  productId: string;
  code: string;
  name: string;
  /** List/catalog unit price. Ignored for totals when orderByUnit (dual-mode units). */
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

function newLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Match key: one draft line per product + measure (kg vs units). */
export function draftLineKey(productId: string, orderByUnit: boolean): string {
  return `${productId}:${orderByUnit ? "u" : "k"}`;
}

type QuoteDraftState = {
  lines: QuoteDraftLine[];
  addOrUpdate: (
    line: Omit<QuoteDraftLine, "id" | "qty" | "orderByUnit" | "allowsUnitOrder"> & {
      qty?: number;
      orderByUnit?: boolean;
      allowsUnitOrder?: boolean;
    },
  ) => void;
  setQty: (lineId: string, qty: number) => void;
  setOrderByUnit: (lineId: string, orderByUnit: boolean) => void;
  remove: (lineId: string) => void;
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
        const key = draftLineKey(line.productId, orderByUnit);
        set((state) => {
          const existing = state.lines.find(
            (l) => draftLineKey(l.productId, l.orderByUnit) === key,
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.id === existing.id
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
                id: newLineId(),
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
      setQty: (lineId, qty) => {
        if (qty <= 0) {
          get().remove(lineId);
          return;
        }
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === lineId ? { ...l, qty } : l,
          ),
        }));
      },
      setOrderByUnit: (lineId, orderByUnit) => {
        set((state) => {
          const line = state.lines.find((l) => l.id === lineId);
          if (!line || !line.allowsUnitOrder || line.orderByUnit === orderByUnit) {
            return state;
          }
          const sibling = state.lines.find(
            (l) =>
              l.id !== lineId &&
              l.productId === line.productId &&
              l.orderByUnit === orderByUnit,
          );
          if (sibling) {
            return {
              lines: state.lines
                .filter((l) => l.id !== lineId)
                .map((l) =>
                  l.id === sibling.id
                    ? { ...l, qty: l.qty + line.qty }
                    : l,
                ),
            };
          }
          return {
            lines: state.lines.map((l) =>
              l.id === lineId ? { ...l, orderByUnit } : l,
            ),
          };
        });
      },
      remove: (lineId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.id !== lineId),
        })),
      clear: () => set({ lines: [] }),
      total: () =>
        get().lines.reduce((sum, l) => sum + effectiveLineTotal(l), 0),
    }),
    {
      name: "rocha-quote-draft",
      version: 3,
      migrate: (persisted) => {
        const state = persisted as { lines?: Array<Partial<QuoteDraftLine>> };
        const seen = new Set<string>();
        const lines: QuoteDraftLine[] = [];
        for (const l of state.lines ?? []) {
          const productId = String(l.productId ?? "");
          const orderByUnit = Boolean(l.orderByUnit);
          const key = draftLineKey(productId, orderByUnit);
          const qty = Number(l.qty) || 0;
          if (!productId || qty <= 0) continue;
          const existing = lines.find(
            (row) => draftLineKey(row.productId, row.orderByUnit) === key,
          );
          if (existing) {
            existing.qty += qty;
            continue;
          }
          if (seen.has(key)) continue;
          seen.add(key);
          lines.push({
            id: typeof l.id === "string" && l.id ? l.id : newLineId(),
            productId,
            code: String(l.code ?? ""),
            name: String(l.name ?? ""),
            unitPrice: Number(l.unitPrice) || 0,
            qty,
            orderByUnit,
            allowsUnitOrder: Boolean(l.allowsUnitOrder),
          });
        }
        return { lines };
      },
    },
  ),
);
