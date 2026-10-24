import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tag-names";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import { getActiveProductsBase } from "@/lib/products-cache";
import { resolveStockProductReportMap } from "@/lib/stock-product-lookup";
import {
  serializeStockLinesWithProducts,
  stockLineFlatSelect,
  type ProductReportRow,
} from "@/lib/stock-line-serialize";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import { productWhereForModule } from "@/lib/stock-rubros";
import { getStockModuleProducts } from "@/lib/stock-products-cache";

export type StockTab = "desperdicios" | "consumibles" | "activos";

export const STOCK_HISTORY_LIMIT = 20;

export type StockModuleCustomer = {
  id: string;
  code: string;
  name: string;
};

/** Product selected in stock filters (URL `product=`). */
export type StockFilterProduct = {
  id: string;
  code: string;
  name: string;
  rubro: string | null;
  unitPrice: number;
  allowsUnitOrder: boolean;
  stockKind: "DESPERDICIO" | "CONSUMABLE" | "LOCAL_ASSET" | null;
};

export function parseStockTab(tab?: string): StockTab {
  if (tab === "consumibles") return "consumibles";
  if (tab === "activos") return "activos";
  if (tab === "desperdicios" || tab === "elaborados") return "desperdicios";
  return "desperdicios";
}

export function resolveStockCustomerId(
  customers: StockModuleCustomer[],
  customerParam?: string,
): string {
  const id = (customerParam ?? "").trim();
  if (!id) return "";
  return customers.some((c) => c.id === id) ? id : "";
}

/** Resolve URL `product=` against the active stock module catalog. */
export async function resolveStockFilterProduct(
  module: StockModuleKey,
  productParam?: string,
): Promise<StockFilterProduct | null> {
  const id = (productParam ?? "").trim();
  if (!id) return null;

  const catalog = await getStockModuleProducts(module);
  const hit = catalog.find((p) => p.id === id);
  if (hit) {
    return {
      id: hit.id,
      code: hit.code,
      name: hit.name,
      rubro: hit.rubro,
      unitPrice: hit.basePrice,
      allowsUnitOrder: hit.allowsUnitOrder,
      stockKind: hit.stockKind,
    };
  }

  // Cache miss / brand-new product — one DB check, still module-scoped.
  const row = await db.product.findFirst({
    where: { id, ...productWhereForModule(module) },
    select: {
      id: true,
      code: true,
      name: true,
      rubro: true,
      basePrice: true,
      allowsUnitOrder: true,
      stockKind: true,
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    rubro: row.rubro,
    unitPrice: Number(row.basePrice),
    allowsUnitOrder: row.allowsUnitOrder,
    stockKind: row.stockKind,
  };
}

async function fetchModuleCustomersUncached(
  module: "DESPERDICIOS" | "CONSUMABLES" | "ACTIVOS",
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

export async function moduleCustomers(
  module: "DESPERDICIOS" | "CONSUMABLES" | "ACTIVOS",
) {
  return getCachedModuleCustomers(module);
}

function stockEntryWhere(
  from: string,
  to: string,
  customerId?: string,
  productId?: string,
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
    ...(productId ? { lines: { some: { productId } } } : {}),
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
  productId?: string,
) {
  const narrowed = productId
    ? rows.map((row) => ({
        ...row,
        lines: row.lines.filter((line) => line.productId === productId),
      }))
    : rows;
  const productIds = [
    ...new Set(
      narrowed.flatMap((row) => row.lines.map((line) => line.productId)),
    ),
  ];
  const productById = await resolveStockProductReportMap(productIds, catalog);
  return mapStockEntryListRows(narrowed, customers, productById);
}

const stockEntryListSelect = {
  id: true,
  entryDate: true,
  notes: true,
  submittedBy: true,
  customerId: true,
  lines: { select: stockLineFlatSelect },
} as const;

export async function loadDesperdiciosEntries(
  from: string,
  to: string,
  customerId?: string,
  limit = STOCK_HISTORY_LIMIT,
  productId?: string,
) {
  const [rows, customers, catalog] = await Promise.all([
    db.desperdicioEntry.findMany({
      where: stockEntryWhere(from, to, customerId, productId),
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: stockEntryListSelect,
    }),
    moduleCustomers("DESPERDICIOS"),
    getActiveProductsBase(),
  ]);

  return hydrateStockEntryListRows(rows, catalog, customers, productId);
}

export async function loadConsumiblesEntries(
  from: string,
  to: string,
  customerId?: string,
  limit = STOCK_HISTORY_LIMIT,
  productId?: string,
) {
  const [rows, customers, catalog] = await Promise.all([
    db.consumableCount.findMany({
      where: stockEntryWhere(from, to, customerId, productId),
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: stockEntryListSelect,
    }),
    moduleCustomers("CONSUMABLES"),
    getActiveProductsBase(),
  ]);

  return hydrateStockEntryListRows(rows, catalog, customers, productId);
}

export async function loadActivosEntries(
  from: string,
  to: string,
  customerId?: string,
  limit = STOCK_HISTORY_LIMIT,
  productId?: string,
) {
  const [rows, customers, catalog] = await Promise.all([
    db.localAssetCount.findMany({
      where: stockEntryWhere(from, to, customerId, productId),
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: stockEntryListSelect,
    }),
    moduleCustomers("ACTIVOS"),
    getActiveProductsBase(),
  ]);

  return hydrateStockEntryListRows(rows, catalog, customers, productId);
}
