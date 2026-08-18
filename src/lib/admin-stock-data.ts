import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import {
  serializeStockLine,
  stockLineSelect,
} from "@/lib/stock-line-serialize";

export type StockTab = "elaborados" | "consumibles";

export const STOCK_HISTORY_LIMIT = 20;

export type StockModuleCustomer = {
  id: string;
  code: string;
  name: string;
};

export function parseStockTab(tab?: string): StockTab {
  return tab === "consumibles" ? "consumibles" : "elaborados";
}

export function resolveStockCustomerId(
  customers: StockModuleCustomer[],
  customerParam?: string,
): string {
  const id = (customerParam ?? "").trim();
  if (!id) return "";
  return customers.some((c) => c.id === id) ? id : "";
}

export async function moduleCustomers(module: "MERMAS" | "CONSUMABLES") {
  return db.customer.findMany({
    where: {
      active: true,
      moduleAccess: { some: { module, enabled: true } },
    },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

function stockEntryWhere(
  from: string,
  to: string,
  customerId?: string,
) {
  const fromDate = from ? parseDateOnlyYmd(from) : null;
  const toDate = to ? parseDateOnlyYmd(to) : null;
  const dateFilter =
    fromDate || toDate
      ? {
          entryDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {};

  return {
    ...dateFilter,
    ...(customerId ? { customerId } : {}),
  };
}

export async function loadElaboradosEntries(
  from: string,
  to: string,
  customerId?: string,
) {
  const rows = await db.mermaEntry.findMany({
    where: stockEntryWhere(from, to, customerId),
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: STOCK_HISTORY_LIMIT,
    select: {
      id: true,
      entryDate: true,
      notes: true,
      submittedBy: true,
      customer: { select: { code: true, name: true } },
      lines: { select: stockLineSelect },
    },
  });

  return rows.map((e) => ({
    id: e.id,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    notes: e.notes,
    submittedBy: e.submittedBy,
    customer: e.customer,
    lines: e.lines.map(serializeStockLine),
  }));
}

export async function loadConsumiblesEntries(
  from: string,
  to: string,
  customerId?: string,
) {
  const rows = await db.consumableCount.findMany({
    where: stockEntryWhere(from, to, customerId),
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: STOCK_HISTORY_LIMIT,
    select: {
      id: true,
      entryDate: true,
      notes: true,
      submittedBy: true,
      customer: { select: { code: true, name: true } },
      lines: { select: stockLineSelect },
    },
  });

  return rows.map((e) => ({
    id: e.id,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    notes: e.notes,
    submittedBy: e.submittedBy,
    customer: e.customer,
    lines: e.lines.map(serializeStockLine),
  }));
}
