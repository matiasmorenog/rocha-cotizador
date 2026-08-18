import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
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

async function fetchModuleCustomersUncached(
  module: "MERMAS" | "CONSUMABLES",
): Promise<StockModuleCustomer[]> {
  const [customers, accessRows] = await Promise.all([
    db.customer.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.customerModuleAccess.findMany({
      where: { module, enabled: true },
      select: { customerId: true },
    }),
  ]);

  const enabledIds = new Set(accessRows.map((r) => r.customerId));
  return customers.filter((c) => enabledIds.has(c.id));
}

const getCachedModuleCustomers = unstable_cache(
  fetchModuleCustomersUncached,
  ["admin-stock-module-customers"],
  { tags: [CACHE_TAGS.customers], revalidate: 86400 },
);

export async function moduleCustomers(module: "MERMAS" | "CONSUMABLES") {
  return getCachedModuleCustomers(module);
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
      customerId: true,
      lines: { select: stockLineSelect },
    },
  });

  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const customers =
    customerIds.length > 0
      ? await db.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
  const customerById = new Map(customers.map((c) => [c.id, c] as const));

  return rows.map((e) => {
    const customer = customerById.get(e.customerId);
    return {
      id: e.id,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      notes: e.notes,
      submittedBy: e.submittedBy,
      customer: customer ?? { code: "?", name: "—" },
      lines: e.lines.map(serializeStockLine),
    };
  });
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
      customerId: true,
      lines: { select: stockLineSelect },
    },
  });

  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const customers =
    customerIds.length > 0
      ? await db.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
  const customerById = new Map(customers.map((c) => [c.id, c] as const));

  return rows.map((e) => {
    const customer = customerById.get(e.customerId);
    return {
      id: e.id,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      notes: e.notes,
      submittedBy: e.submittedBy,
      customer: customer ?? { code: "?", name: "—" },
      lines: e.lines.map(serializeStockLine),
    };
  });
}
