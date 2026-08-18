import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  moduleCustomers,
  resolveStockCustomerId,
  type StockTab,
} from "@/lib/admin-stock-data";
import {
  formatStockDayLabel,
  stockSummaryDayCount,
  type StockSummaryDailyPoint,
  type StockSummaryPayload,
  type StockSummaryProductRow,
} from "@/lib/admin-stock-summary-shared";
import { addCalendarDaysYmd, parseDateOnlyYmd } from "@/lib/delivery-date";

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

function buildDailySeries(
  from: string,
  to: string,
  rows: Array<{ date: string; totalCost: number }>,
): StockSummaryDailyPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row.totalCost]));
  const points: StockSummaryDailyPoint[] = [];
  let cursor = from;

  while (cursor <= to) {
    points.push({
      date: cursor,
      label: formatStockDayLabel(cursor),
      totalCost: byDate.get(cursor) ?? 0,
    });
    cursor = addCalendarDaysYmd(cursor, 1);
  }

  return points;
}

type ProductAggRow = {
  productId: string;
  unit: string;
  code: string;
  name: string;
  totalQty: number;
  basePrice: number;
  totalCost: number;
  lastDate: Date;
};

function assembleSummaryPayload(input: {
  dayCount: number;
  entryCount: number;
  productRows: ProductAggRow[];
  dailyRows: Array<{ date: string; totalCost: number }>;
  from: string;
  to: string;
}): Omit<StockSummaryPayload, "tab" | "from" | "to"> {
  const products: StockSummaryProductRow[] = input.productRows.map((row) => {
    const totalCost = decimalToNumber(row.totalCost);
    const basePrice = decimalToNumber(row.basePrice);
    return {
      productId: row.productId,
      code: row.code || "—",
      name: row.name || "Producto",
      unit: row.unit,
      totalQty: decimalToNumber(row.totalQty),
      basePrice,
      totalCost,
      avgCostPerDay: totalCost / input.dayCount,
      lastEntryDate: row.lastDate.toISOString().slice(0, 10),
    };
  });

  const totalBaseCost = products.reduce((sum, row) => sum + row.totalCost, 0);
  const distinctProducts = new Set(products.map((row) => row.productId)).size;

  return {
    dayCount: input.dayCount,
    entryCount: input.entryCount,
    distinctProducts,
    totalBaseCost,
    avgBaseCostPerDay: totalBaseCost / input.dayCount,
    products,
    daily: buildDailySeries(input.from, input.to, input.dailyRows),
  };
}

function emptySummary(
  from: string,
  to: string,
  dayCount: number,
): Omit<StockSummaryPayload, "tab" | "from" | "to"> {
  return {
    dayCount,
    entryCount: 0,
    distinctProducts: 0,
    totalBaseCost: 0,
    avgBaseCostPerDay: 0,
    products: [],
    daily: buildDailySeries(from, to, []),
  };
}

function mapDailyRows(
  dailyRows: Array<{ entryDate: Date; totalCost: number }>,
) {
  return dailyRows.map((row) => ({
    date: row.entryDate.toISOString().slice(0, 10),
    totalCost: decimalToNumber(row.totalCost),
  }));
}

async function loadElaboradosSummary(
  fromDate: Date,
  toDate: Date,
  customerIds: string[],
  from: string,
  to: string,
  dayCount: number,
): Promise<Omit<StockSummaryPayload, "tab" | "from" | "to">> {
  const customerFilter =
    customerIds.length === 1
      ? Prisma.sql`e."customerId" = ${customerIds[0]}`
      : Prisma.sql`e."customerId" IN (${Prisma.join(customerIds)})`;

  const entryWhere = Prisma.sql`
    e."entryDate" >= ${fromDate}
    AND e."entryDate" <= ${toDate}
    AND ${customerFilter}
  `;

  const [entryCountRow, productRows, dailyRows] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "MermaEntry" e
      WHERE ${entryWhere}
    `,
    db.$queryRaw<ProductAggRow[]>`
      SELECT
        l."productId",
        l.unit,
        MAX(p.code) AS code,
        MAX(p.name) AS name,
        SUM(l.qty)::float AS "totalQty",
        MAX(p."basePrice")::float AS "basePrice",
        SUM(l.qty * p."basePrice")::float AS "totalCost",
        MAX(e."entryDate") AS "lastDate"
      FROM "MermaLine" l
      INNER JOIN "MermaEntry" e ON e.id = l."entryId"
      INNER JOIN "Product" p ON p.id = l."productId"
      WHERE ${entryWhere}
      GROUP BY l."productId", l.unit
      ORDER BY "totalCost" DESC
    `,
    db.$queryRaw<{ entryDate: Date; totalCost: number }[]>`
      SELECT e."entryDate", SUM(l.qty * p."basePrice")::float AS "totalCost"
      FROM "MermaEntry" e
      INNER JOIN "MermaLine" l ON l."entryId" = e.id
      INNER JOIN "Product" p ON p.id = l."productId"
      WHERE ${entryWhere}
      GROUP BY e."entryDate"
      ORDER BY e."entryDate"
    `,
  ]);

  return assembleSummaryPayload({
    dayCount,
    entryCount: Number(entryCountRow[0]?.count ?? 0),
    productRows,
    dailyRows: mapDailyRows(dailyRows),
    from,
    to,
  });
}

async function loadConsumiblesSummary(
  fromDate: Date,
  toDate: Date,
  customerIds: string[],
  from: string,
  to: string,
  dayCount: number,
): Promise<Omit<StockSummaryPayload, "tab" | "from" | "to">> {
  const customerFilter =
    customerIds.length === 1
      ? Prisma.sql`c."customerId" = ${customerIds[0]}`
      : Prisma.sql`c."customerId" IN (${Prisma.join(customerIds)})`;

  const entryWhere = Prisma.sql`
    c."entryDate" >= ${fromDate}
    AND c."entryDate" <= ${toDate}
    AND ${customerFilter}
  `;

  const [entryCountRow, productRows, dailyRows] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "ConsumableCount" c
      WHERE ${entryWhere}
    `,
    db.$queryRaw<ProductAggRow[]>`
      SELECT
        l."productId",
        l.unit,
        MAX(p.code) AS code,
        MAX(p.name) AS name,
        SUM(l.qty)::float AS "totalQty",
        MAX(p."basePrice")::float AS "basePrice",
        SUM(l.qty * p."basePrice")::float AS "totalCost",
        MAX(c."entryDate") AS "lastDate"
      FROM "ConsumableCountLine" l
      INNER JOIN "ConsumableCount" c ON c.id = l."countId"
      INNER JOIN "Product" p ON p.id = l."productId"
      WHERE ${entryWhere}
      GROUP BY l."productId", l.unit
      ORDER BY "totalCost" DESC
    `,
    db.$queryRaw<{ entryDate: Date; totalCost: number }[]>`
      SELECT c."entryDate", SUM(l.qty * p."basePrice")::float AS "totalCost"
      FROM "ConsumableCount" c
      INNER JOIN "ConsumableCountLine" l ON l."countId" = c.id
      INNER JOIN "Product" p ON p.id = l."productId"
      WHERE ${entryWhere}
      GROUP BY c."entryDate"
      ORDER BY c."entryDate"
    `,
  ]);

  return assembleSummaryPayload({
    dayCount,
    entryCount: Number(entryCountRow[0]?.count ?? 0),
    productRows,
    dailyRows: mapDailyRows(dailyRows),
    from,
    to,
  });
}

export async function getStockSummary(input: {
  tab: StockTab;
  from: string;
  to: string;
  customerId?: string;
}): Promise<StockSummaryPayload> {
  const fromDate = parseDateOnlyYmd(input.from);
  const toDate = parseDateOnlyYmd(input.to);
  if (!fromDate || !toDate || input.from > input.to) {
    throw new Error("Rango de fechas inválido");
  }

  const stockModule = input.tab === "consumibles" ? "CONSUMABLES" : "MERMAS";
  const customers = await moduleCustomers(stockModule);
  const resolvedCustomerId = resolveStockCustomerId(
    customers,
    input.customerId,
  );
  const customerIds = resolvedCustomerId
    ? [resolvedCustomerId]
    : customers.map((customer) => customer.id);

  const dayCount = stockSummaryDayCount(input.from, input.to);

  if (customerIds.length === 0) {
    return {
      tab: input.tab,
      from: input.from,
      to: input.to,
      ...emptySummary(input.from, input.to, dayCount),
    };
  }

  const core =
    input.tab === "consumibles"
      ? await loadConsumiblesSummary(
          fromDate,
          toDate,
          customerIds,
          input.from,
          input.to,
          dayCount,
        )
      : await loadElaboradosSummary(
          fromDate,
          toDate,
          customerIds,
          input.from,
          input.to,
          dayCount,
        );

  return {
    tab: input.tab,
    from: input.from,
    to: input.to,
    ...core,
  };
}
