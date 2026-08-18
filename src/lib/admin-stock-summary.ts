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
  rows: Array<{ date: string; totalQty: number }>,
): StockSummaryDailyPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row.totalQty]));
  const points: StockSummaryDailyPoint[] = [];
  let cursor = from;

  while (cursor <= to) {
    points.push({
      date: cursor,
      label: formatStockDayLabel(cursor),
      totalQty: byDate.get(cursor) ?? 0,
    });
    cursor = addCalendarDaysYmd(cursor, 1);
  }

  return points;
}

type ProductAggRow = {
  productId: string;
  unit: string;
  totalQty: number;
};

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

  const [entryCountRow, distinctRow, unitRows, productRows, dailyRows, lastDateRows] =
    await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "MermaEntry" e
        WHERE ${entryWhere}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT l."productId")::bigint AS count
        FROM "MermaLine" l
        INNER JOIN "MermaEntry" e ON e.id = l."entryId"
        WHERE ${entryWhere}
      `,
      db.$queryRaw<{ unit: string; totalQty: number }[]>`
        SELECT l.unit, SUM(l.qty)::float AS "totalQty"
        FROM "MermaLine" l
        INNER JOIN "MermaEntry" e ON e.id = l."entryId"
        WHERE ${entryWhere}
        GROUP BY l.unit
        ORDER BY l.unit
      `,
      db.$queryRaw<ProductAggRow[]>`
        SELECT
          l."productId",
          l.unit,
          SUM(l.qty)::float AS "totalQty"
        FROM "MermaLine" l
        INNER JOIN "MermaEntry" e ON e.id = l."entryId"
        WHERE ${entryWhere}
        GROUP BY l."productId", l.unit
        ORDER BY "totalQty" DESC
      `,
      db.$queryRaw<{ entryDate: Date; totalQty: number }[]>`
        SELECT e."entryDate", SUM(l.qty)::float AS "totalQty"
        FROM "MermaEntry" e
        INNER JOIN "MermaLine" l ON l."entryId" = e.id
        WHERE ${entryWhere}
        GROUP BY e."entryDate"
        ORDER BY e."entryDate"
      `,
      db.$queryRaw<{ productId: string; lastDate: Date }[]>`
        SELECT l."productId", MAX(e."entryDate") AS "lastDate"
        FROM "MermaLine" l
        INNER JOIN "MermaEntry" e ON e.id = l."entryId"
        WHERE ${entryWhere}
        GROUP BY l."productId"
      `,
    ]);

  return assembleSummaryPayload({
    dayCount,
    entryCount: Number(entryCountRow[0]?.count ?? 0),
    distinctProducts: Number(distinctRow[0]?.count ?? 0),
    unitRows,
    productRows,
    dailyRows: dailyRows.map((row) => ({
      date: row.entryDate.toISOString().slice(0, 10),
      totalQty: decimalToNumber(row.totalQty),
    })),
    lastDateRows: new Map(
      lastDateRows.map((row) => [
        row.productId,
        row.lastDate.toISOString().slice(0, 10),
      ]),
    ),
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

  const [entryCountRow, distinctRow, unitRows, productRows, dailyRows, lastDateRows] =
    await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "ConsumableCount" c
        WHERE ${entryWhere}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT l."productId")::bigint AS count
        FROM "ConsumableCountLine" l
        INNER JOIN "ConsumableCount" c ON c.id = l."countId"
        WHERE ${entryWhere}
      `,
      db.$queryRaw<{ unit: string; totalQty: number }[]>`
        SELECT l.unit, SUM(l.qty)::float AS "totalQty"
        FROM "ConsumableCountLine" l
        INNER JOIN "ConsumableCount" c ON c.id = l."countId"
        WHERE ${entryWhere}
        GROUP BY l.unit
        ORDER BY l.unit
      `,
      db.$queryRaw<ProductAggRow[]>`
        SELECT
          l."productId",
          l.unit,
          SUM(l.qty)::float AS "totalQty"
        FROM "ConsumableCountLine" l
        INNER JOIN "ConsumableCount" c ON c.id = l."countId"
        WHERE ${entryWhere}
        GROUP BY l."productId", l.unit
        ORDER BY "totalQty" DESC
      `,
      db.$queryRaw<{ entryDate: Date; totalQty: number }[]>`
        SELECT c."entryDate", SUM(l.qty)::float AS "totalQty"
        FROM "ConsumableCount" c
        INNER JOIN "ConsumableCountLine" l ON l."countId" = c.id
        WHERE ${entryWhere}
        GROUP BY c."entryDate"
        ORDER BY c."entryDate"
      `,
      db.$queryRaw<{ productId: string; lastDate: Date }[]>`
        SELECT l."productId", MAX(c."entryDate") AS "lastDate"
        FROM "ConsumableCountLine" l
        INNER JOIN "ConsumableCount" c ON c.id = l."countId"
        WHERE ${entryWhere}
        GROUP BY l."productId"
      `,
    ]);

  return assembleSummaryPayload({
    dayCount,
    entryCount: Number(entryCountRow[0]?.count ?? 0),
    distinctProducts: Number(distinctRow[0]?.count ?? 0),
    unitRows,
    productRows,
    dailyRows: dailyRows.map((row) => ({
      date: row.entryDate.toISOString().slice(0, 10),
      totalQty: decimalToNumber(row.totalQty),
    })),
    lastDateRows: new Map(
      lastDateRows.map((row) => [
        row.productId,
        row.lastDate.toISOString().slice(0, 10),
      ]),
    ),
    from,
    to,
  });
}

async function assembleSummaryPayload(input: {
  dayCount: number;
  entryCount: number;
  distinctProducts: number;
  unitRows: Array<{ unit: string; totalQty: number }>;
  productRows: ProductAggRow[];
  dailyRows: Array<{ date: string; totalQty: number }>;
  lastDateRows: Map<string, string>;
  from: string;
  to: string;
}): Promise<Omit<StockSummaryPayload, "tab" | "from" | "to">> {
  const productIds = [...new Set(input.productRows.map((row) => row.productId))];
  const productsById =
    productIds.length === 0
      ? new Map<string, { code: string; name: string }>()
      : new Map(
          (
            await db.product.findMany({
              where: { id: { in: productIds } },
              select: { id: true, code: true, name: true },
            })
          ).map((product) => [product.id, product]),
        );

  const products: StockSummaryProductRow[] = input.productRows.map((row) => {
    const product = productsById.get(row.productId);
    const totalQty = decimalToNumber(row.totalQty);
    return {
      productId: row.productId,
      code: product?.code ?? "—",
      name: product?.name ?? "Producto",
      unit: row.unit,
      totalQty,
      avgPerDay: totalQty / input.dayCount,
      lastEntryDate: input.lastDateRows.get(row.productId) ?? null,
    };
  });

  const unitTotals = input.unitRows.map((row) => ({
    unit: row.unit,
    totalQty: decimalToNumber(row.totalQty),
  }));

  return {
    dayCount: input.dayCount,
    entryCount: input.entryCount,
    distinctProducts: input.distinctProducts,
    unitTotals,
    mixedUnits: unitTotals.length > 1,
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
    unitTotals: [],
    mixedUnits: false,
    products: [],
    daily: buildDailySeries(from, to, []),
  };
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
