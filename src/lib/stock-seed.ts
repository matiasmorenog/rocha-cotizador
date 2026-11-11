import { db } from "@/lib/db";
import {
  ACTIVOS_SEED_CODES,
  CONSUMABLES_SEED_CODES,
  DESPERDICIOS_SEED_CODES,
} from "@/lib/customer-modules";
import { toArgentinaDatetimeLocal } from "@/lib/argentina-time";
import { addCalendarDaysYmd } from "@/lib/delivery-date";
import { productWhereForModule } from "@/lib/stock-rubros";
import type { StockModuleKey } from "@/lib/stock-product-kind-shared";
import { defaultStockUnitForProduct } from "@/lib/stock-units";

type SeedStockSpec = {
  /** Prefer exact Product.code when present. */
  code?: string;
  /** Fallback: name contains (case-insensitive). */
  nameIncludes?: string;
};

/**
 * Real Product rows from Rocha catalog (dev Neon), not invented SKUs.
 * Module split uses Product.stockKind / rubro via productWhereForModule.
 */
export const SAMPLE_STOCK_FROM_PRODUCTS: SeedStockSpec[] = [
  { code: "1902", nameIncludes: "LEVADURA" },
  { code: "2401", nameIncludes: "BAGUETTE (CRUDO)" },
  { code: "2403", nameIncludes: "FLAUTITA (CRUDO)" },
  { code: "2409", nameIncludes: "CHIPS (CRUDO)" },
  { code: "0021", nameIncludes: "FLAUTA" },
  { code: "0020", nameIncludes: "FIGASA" },
  { code: "0064", nameIncludes: "HAMBURGUESA" },
  { code: "0502", nameIncludes: "FACTURAS DOCENA" },
  { code: "0405", nameIncludes: "PREPIZZA INDIVIDUAL" },
  { code: "0129", nameIncludes: "FLAUTON" },
  { code: "1801", nameIncludes: "BOX CUMPLE GRANDE" },
  { code: "1802", nameIncludes: "BOX CUMPLE CHICO" },
  { code: "1210", nameIncludes: "BANDEJAS MASAS" },
];

function todayYmdAr(): string {
  return toArgentinaDatetimeLocal(new Date()).slice(0, 10);
}

function parseYmdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer ${min}..${max}, got ${raw}`);
  }
  return n;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randQty(module: StockModuleKey): number {
  if (module === "CONSUMABLES") return randInt(1, 48);
  if (module === "ACTIVOS") return randInt(1, 12);
  // desperdicios: mix of whole + fractional kg-like
  const whole = randInt(0, 1) === 1;
  if (whole) return randInt(1, 8);
  return Number((Math.random() * 4 + 0.25).toFixed(2));
}

async function resolveProductId(spec: SeedStockSpec): Promise<string | null> {
  if (spec.code) {
    const byCode = await db.product.findFirst({
      where: { code: spec.code, available: true },
      select: { id: true },
    });
    if (byCode) return byCode.id;
  }
  if (spec.nameIncludes) {
    const byName = await db.product.findFirst({
      where: {
        available: true,
        name: { contains: spec.nameIncludes, mode: "insensitive" },
      },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    if (byName) return byName.id;
  }
  return null;
}

async function resolveProductsForModule(
  module: StockModuleKey,
  limit: number,
): Promise<Array<{ id: string; unit: string }>> {
  const out: Array<{ id: string; unit: string }> = [];
  const moduleFilter = productWhereForModule(module);

  for (const spec of SAMPLE_STOCK_FROM_PRODUCTS) {
    if (out.length >= limit) break;
    const productId = await resolveProductId(spec);
    if (!productId) continue;

    const product = await db.product.findFirst({
      where: { id: productId, ...moduleFilter },
      select: { id: true, allowsUnitOrder: true },
    });
    if (!product) continue;

    out.push({
      id: product.id,
      unit: defaultStockUnitForProduct(product.allowsUnitOrder),
    });
  }

  if (out.length >= limit) return out;

  const extras = await db.product.findMany({
    where: moduleFilter,
    orderBy: [{ rubro: "asc" }, { name: "asc" }],
    take: limit - out.length + 20,
    select: { id: true, allowsUnitOrder: true },
  });
  for (const p of extras) {
    if (out.some((row) => row.id === p.id)) continue;
    out.push({
      id: p.id,
      unit: defaultStockUnitForProduct(p.allowsUnitOrder),
    });
    if (out.length >= limit) break;
  }

  return out;
}

async function findCustomersWithCodes(
  codes: readonly string[],
  max: number,
): Promise<Array<{ id: string; code: string }>> {
  const out: Array<{ id: string; code: string }> = [];
  for (const code of codes) {
    if (out.length >= max) break;
    const customer = await db.customer.findUnique({
      where: { code },
      select: { id: true, code: true },
    });
    if (customer) out.push(customer);
  }
  return out;
}

function pickEntryDates(daysBack: number, entriesPerCustomer: number): string[] {
  const today = todayYmdAr();
  const pool: string[] = [];
  for (let i = 0; i < daysBack; i++) {
    pool.push(addCalendarDaysYmd(today, -i));
  }
  // Prefer denser recent days: shuffle then take N unique
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(entriesPerCustomer, pool.length)).sort();
}

/** Wipe sample desperdicio / consumible / activos entries (dev seed only). */
export async function clearStockSampleData(): Promise<void> {
  await db.desperdicioLine.deleteMany({});
  await db.consumableCountLine.deleteMany({});
  await db.localAssetCountLine.deleteMany({});
  await db.desperdicioEntry.deleteMany({});
  await db.consumableCount.deleteMany({});
  await db.localAssetCount.deleteMany({});
}

type ModuleSeedResult = {
  customers: string[];
  entries: number;
  lines: number;
};

async function seedModuleEntries(
  module: StockModuleKey,
  codes: readonly string[],
  opts: {
    daysBack: number;
    entriesPerCustomer: number;
    customersMax: number;
    linesPerEntry: number;
  },
): Promise<ModuleSeedResult> {
  const customers = await findCustomersWithCodes(codes, opts.customersMax);
  const products = await resolveProductsForModule(module, opts.linesPerEntry + 4);
  if (customers.length === 0 || products.length === 0) {
    return { customers: [], entries: 0, lines: 0 };
  }

  let entries = 0;
  let lines = 0;

  for (const customer of customers) {
    const dates = pickEntryDates(opts.daysBack, opts.entriesPerCustomer);
    for (const ymd of dates) {
      const entryDate = parseYmdToDate(ymd);
      const lineCount = Math.min(
        products.length,
        randInt(Math.max(2, Math.floor(opts.linesPerEntry / 2)), opts.linesPerEntry),
      );
      const lineProducts = products.slice(0, lineCount);
      // shuffle lightly
      for (let i = lineProducts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lineProducts[i], lineProducts[j]] = [lineProducts[j]!, lineProducts[i]!];
      }
      const createLines = lineProducts.map((item) => ({
        productId: item.id,
        unit: item.unit,
        qty: randQty(module),
      }));

      if (module === "DESPERDICIOS") {
        await db.desperdicioEntry.deleteMany({
          where: { customerId: customer.id, entryDate },
        });
        await db.desperdicioEntry.create({
          data: {
            customerId: customer.id,
            entryDate,
            notes: "Carga de prueba (seed)",
            submittedBy: "seed",
            lines: { create: createLines },
          },
        });
      } else if (module === "CONSUMABLES") {
        await db.consumableCount.deleteMany({
          where: { customerId: customer.id, entryDate },
        });
        await db.consumableCount.create({
          data: {
            customerId: customer.id,
            entryDate,
            notes: "Conteo de prueba (seed)",
            submittedBy: "seed",
            lines: { create: createLines },
          },
        });
      } else {
        await db.localAssetCount.deleteMany({
          where: { customerId: customer.id, entryDate },
        });
        await db.localAssetCount.create({
          data: {
            customerId: customer.id,
            entryDate,
            notes: "Activos de prueba (seed)",
            submittedBy: "seed",
            lines: { create: createLines },
          },
        });
      }

      entries += 1;
      lines += createLines.length;
    }
  }

  return {
    customers: customers.map((c) => c.code),
    entries,
    lines,
  };
}

/**
 * Multi-day sample across Desperdicios / Consumibles / Activos.
 * Env: DAYS_BACK (default 18), ENTRIES_PER_CUSTOMER (default 8),
 * CUSTOMERS_PER_MODULE (default 3), LINES_PER_ENTRY (default 6).
 */
export async function seedSampleStockEntries(): Promise<{
  desperdicios: ModuleSeedResult;
  consumables: ModuleSeedResult;
  activos: ModuleSeedResult;
}> {
  const daysBack = envInt("DAYS_BACK", 18, 3, 60);
  const entriesPerCustomer = envInt("ENTRIES_PER_CUSTOMER", 8, 1, 30);
  const customersMax = envInt("CUSTOMERS_PER_MODULE", 3, 1, 10);
  const linesPerEntry = envInt("LINES_PER_ENTRY", 6, 2, 20);
  const opts = { daysBack, entriesPerCustomer, customersMax, linesPerEntry };

  const desperdicios = await seedModuleEntries(
    "DESPERDICIOS",
    DESPERDICIOS_SEED_CODES,
    opts,
  );
  const consumables = await seedModuleEntries(
    "CONSUMABLES",
    CONSUMABLES_SEED_CODES,
    opts,
  );
  const activos = await seedModuleEntries("ACTIVOS", ACTIVOS_SEED_CODES, opts);

  return { desperdicios, consumables, activos };
}

export async function seedStockSampleData(): Promise<{
  desperdicioLines: number;
  consumableLines: number;
  activoLines: number;
  desperdiciosCustomer: string | null;
  consumableCustomer: string | null;
  activoCustomer: string | null;
  desperdicioEntries: number;
  consumableEntries: number;
  activoEntries: number;
}> {
  await clearStockSampleData();
  const entries = await seedSampleStockEntries();
  return {
    desperdicioLines: entries.desperdicios.lines,
    consumableLines: entries.consumables.lines,
    activoLines: entries.activos.lines,
    desperdiciosCustomer: entries.desperdicios.customers[0] ?? null,
    consumableCustomer: entries.consumables.customers[0] ?? null,
    activoCustomer: entries.activos.customers[0] ?? null,
    desperdicioEntries: entries.desperdicios.entries,
    consumableEntries: entries.consumables.entries,
    activoEntries: entries.activos.entries,
  };
}
