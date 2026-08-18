import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import {
  serializeStockLine,
  stockLineSelect,
} from "@/lib/stock-line-serialize";

export type StockTab = "elaborados" | "consumibles";

export function parseStockTab(tab?: string): StockTab {
  return tab === "consumibles" ? "consumibles" : "elaborados";
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

function entryDateFilter(from: string, to: string) {
  const fromDate = from ? parseDateOnlyYmd(from) : null;
  const toDate = to ? parseDateOnlyYmd(to) : null;
  if (!fromDate && !toDate) return undefined;
  return {
    entryDate: {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    },
  };
}

export async function loadElaboradosEntries(from: string, to: string) {
  const rows = await db.mermaEntry.findMany({
    where: entryDateFilter(from, to),
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 200,
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

export async function loadConsumiblesEntries(from: string, to: string) {
  const rows = await db.consumableCount.findMany({
    where: entryDateFilter(from, to),
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 200,
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
