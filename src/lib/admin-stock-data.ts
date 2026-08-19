import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { getActiveProductsBase } from "@/lib/products-cache";
import { resolveStockProductReportMap } from "@/lib/stock-product-lookup";
import {
  serializeStockLinesWithProducts,
  stockLineFlatSelect,
  type ProductReportRow,
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

type StockEntryListRow = {
  id: string;
  entryDate: Date;
  notes: string | null;
  submittedBy: string | null;
  customerId: string;
  lines: Array<{
    productId: string;
    unit: string;
    qty: { toNumber?: () => number } | number | string;
  }>;
};

function mapStockEntryListRows(
  rows: StockEntryListRow[],
  customers: StockModuleCustomer[],
  productById: Map<string, ProductReportRow>,
) {
  const customerById = new Map(
    customers.map((customer) => [customer.id, customer] as const),
  );

  return rows.map((entry) => {
    const customer = customerById.get(entry.customerId);
    return {
      id: entry.id,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      notes: entry.notes,
      submittedBy: entry.submittedBy,
      customer: customer ?? { code: "?", name: "—" },
      lines: serializeStockLinesWithProducts(entry.lines, productById),
    };
  });
}

async function hydrateStockEntryListRows(
  rows: StockEntryListRow[],
  catalog: Awaited<ReturnType<typeof getActiveProductsBase>>,
  customers: StockModuleCustomer[],
) {
  const productIds = [
    ...new Set(rows.flatMap((row) => row.lines.map((line) => line.productId))),
  ];
  const productById = await resolveStockProductReportMap(productIds, catalog);
  return mapStockEntryListRows(rows, customers, productById);
}

const stockEntryListSelect = {
  id: true,
  entryDate: true,
  notes: true,
  submittedBy: true,
  customerId: true,
  lines: { select: stockLineFlatSelect },
} as const;

export async function loadElaboradosEntries(
  from: string,
  to: string,
  customerId?: string,
  limit = STOCK_HISTORY_LIMIT,
) {
  const [rows, customers, catalog] = await Promise.all([
    db.mermaEntry.findMany({
      where: stockEntryWhere(from, to, customerId),
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: stockEntryListSelect,
    }),
    moduleCustomers("MERMAS"),
    getActiveProductsBase(),
  ]);

  return hydrateStockEntryListRows(rows, catalog, customers);
}

export async function loadConsumiblesEntries(
  from: string,
  to: string,
  customerId?: string,
  limit = STOCK_HISTORY_LIMIT,
) {
  const [rows, customers, catalog] = await Promise.all([
    db.consumableCount.findMany({
      where: stockEntryWhere(from, to, customerId),
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: stockEntryListSelect,
    }),
    moduleCustomers("CONSUMABLES"),
    getActiveProductsBase(),
  ]);

  return hydrateStockEntryListRows(rows, catalog, customers);
}
