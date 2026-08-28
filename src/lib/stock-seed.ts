import { db } from "@/lib/db";
import {
  CONSUMABLES_SEED_CODES,
  MERMAS_SEED_CODES,
} from "@/lib/customer-modules";
import { toArgentinaDatetimeLocal } from "@/lib/argentina-time";
import { productWhereForModule } from "@/lib/stock-rubros";
import { defaultStockUnitForProduct } from "@/lib/stock-units";

type SeedStockSpec = {
  /** Prefer exact Product.code when present. */
  code?: string;
  /** Fallback: name contains (case-insensitive). */
  nameIncludes?: string;
};

/**
 * Real Product rows from Rocha catalog (dev Neon), not invented SKUs.
 * Module split (mermas vs consumibles) uses Product.rubro via productWhereForModule.
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
  module: "MERMAS" | "CONSUMABLES",
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
    take: limit - out.length,
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

/** Wipe sample merma/consumible entries (dev seed only). */
export async function clearStockSampleData(): Promise<void> {
  await db.mermaLine.deleteMany({});
  await db.consumableCountLine.deleteMany({});
  await db.mermaEntry.deleteMany({});
  await db.consumableCount.deleteMany({});
}

async function findFirstCustomerWithCode(
  codes: readonly string[],
): Promise<{ id: string; code: string } | null> {
  for (const code of codes) {
    const customer = await db.customer.findUnique({
      where: { code },
      select: { id: true, code: true },
    });
    if (customer) return customer;
  }
  return null;
}

/** Seed 1 sample MermaEntry + 1 ConsumableCount if customers/products exist. Idempotent. */
export async function seedSampleStockEntries(): Promise<{
  merma: string | null;
  consumable: string | null;
  mermaLines: number;
  consumableLines: number;
}> {
  const entryDate = parseYmdToDate(todayYmdAr());
  let merma: string | null = null;
  let consumable: string | null = null;
  let mermaLines = 0;
  let consumableLines = 0;

  const mermaCustomer = await findFirstCustomerWithCode(MERMAS_SEED_CODES);
  if (mermaCustomer) {
    const products = await resolveProductsForModule("MERMAS", 6);
    if (products.length > 0) {
      const qtys = [1.5, 0.5, 3, 2, 1, 0.25];
      await db.mermaEntry.deleteMany({
        where: { customerId: mermaCustomer.id, entryDate },
      });
      await db.mermaEntry.create({
        data: {
          customerId: mermaCustomer.id,
          entryDate,
          notes: "Carga de prueba (seed)",
          submittedBy: "seed",
          lines: {
            create: products.map((item, i) => ({
              productId: item.id,
              unit: item.unit,
              qty: qtys[i % qtys.length]!,
            })),
          },
        },
      });
      merma = mermaCustomer.code;
      mermaLines = products.length;
    }
  }

  const consumableCustomer = await findFirstCustomerWithCode(
    CONSUMABLES_SEED_CODES,
  );
  if (consumableCustomer) {
    const products = await resolveProductsForModule("CONSUMABLES", 5);
    if (products.length > 0) {
      const qtys = [12, 8, 40, 2, 1];
      await db.consumableCount.deleteMany({
        where: { customerId: consumableCustomer.id, entryDate },
      });
      await db.consumableCount.create({
        data: {
          customerId: consumableCustomer.id,
          entryDate,
          notes: "Conteo de prueba (seed)",
          submittedBy: "seed",
          lines: {
            create: products.map((item, i) => ({
              productId: item.id,
              unit: item.unit,
              qty: qtys[i % qtys.length]!,
            })),
          },
        },
      });
      consumable = consumableCustomer.code;
      consumableLines = products.length;
    }
  }

  return { merma, consumable, mermaLines, consumableLines };
}

export async function seedStockSampleData(): Promise<{
  mermaLines: number;
  consumableLines: number;
  mermaCustomer: string | null;
  consumableCustomer: string | null;
}> {
  await clearStockSampleData();
  const entries = await seedSampleStockEntries();
  return {
    mermaLines: entries.mermaLines,
    consumableLines: entries.consumableLines,
    mermaCustomer: entries.merma,
    consumableCustomer: entries.consumable,
  };
}
