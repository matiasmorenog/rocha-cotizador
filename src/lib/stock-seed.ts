import type { StockItemKind } from "@prisma/client";
import { db } from "@/lib/db";
import {
  CONSUMABLES_SEED_CODES,
  MERMAS_SEED_CODES,
} from "@/lib/customer-modules";
import type { StockUnit } from "@/lib/stock-units";
import { toArgentinaDatetimeLocal } from "@/lib/argentina-time";

type SeedStockSpec = {
  /** Prefer exact Product.code when present. */
  code?: string;
  /** Fallback: name contains (case-insensitive). */
  nameIncludes?: string;
  kind: StockItemKind;
  unit: StockUnit;
  sortOrder: number;
};

/**
 * Real Product rows from Rocha catalog (dev Neon), not invented SKUs.
 * Consumables: no napkin/film SKUs — packaging/regalo stand-ins for demo.
 */
export const SAMPLE_STOCK_FROM_PRODUCTS: SeedStockSpec[] = [
  // RAW — insumos + masa cruda
  {
    code: "1902",
    nameIncludes: "LEVADURA",
    kind: "RAW_MATERIAL",
    unit: "kg",
    sortOrder: 10,
  },
  {
    code: "2401",
    nameIncludes: "BAGUETTE (CRUDO)",
    kind: "RAW_MATERIAL",
    unit: "unid.",
    sortOrder: 20,
  },
  {
    code: "2403",
    nameIncludes: "FLAUTITA (CRUDO)",
    kind: "RAW_MATERIAL",
    unit: "unid.",
    sortOrder: 30,
  },
  {
    code: "2409",
    nameIncludes: "CHIPS (CRUDO)",
    kind: "RAW_MATERIAL",
    unit: "unid.",
    sortOrder: 40,
  },
  // BREAD
  {
    code: "0021",
    nameIncludes: "FLAUTA",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 10,
  },
  {
    code: "0020",
    nameIncludes: "FIGASA",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 20,
  },
  {
    code: "0064",
    nameIncludes: "HAMBURGUESA",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 30,
  },
  {
    code: "0502",
    nameIncludes: "FACTURAS DOCENA",
    kind: "BREAD",
    unit: "docena",
    sortOrder: 40,
  },
  {
    code: "0405",
    nameIncludes: "PREPIZZA INDIVIDUAL",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 50,
  },
  {
    code: "0129",
    nameIncludes: "FLAUTON",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 60,
  },
  // CONSUMABLE — no napkin/film SKUs in catalog; packaging/regalo stand-ins.
  // Admin can replace via product search.
  {
    code: "1801",
    nameIncludes: "BOX CUMPLE GRANDE",
    kind: "CONSUMABLE",
    unit: "unid.",
    sortOrder: 10,
  },
  {
    code: "1802",
    nameIncludes: "BOX CUMPLE CHICO",
    kind: "CONSUMABLE",
    unit: "unid.",
    sortOrder: 20,
  },
  {
    code: "1210",
    nameIncludes: "BANDEJAS MASAS",
    kind: "CONSUMABLE",
    unit: "bandeja",
    sortOrder: 30,
  },
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
      where: { code: spec.code, active: true },
      select: { id: true },
    });
    if (byCode) return byCode.id;
  }
  if (spec.nameIncludes) {
    const byName = await db.product.findFirst({
      where: {
        active: true,
        name: { contains: spec.nameIncludes, mode: "insensitive" },
      },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    if (byName) return byName.id;
  }
  return null;
}

/** Wipe sample merma/consumible lines + all stock memberships (dev seed only). */
export async function clearStockSampleData(): Promise<void> {
  await db.mermaLine.deleteMany({});
  await db.consumableCountLine.deleteMany({});
  await db.mermaEntry.deleteMany({});
  await db.consumableCount.deleteMany({});
  await db.stockItem.deleteMany({});
}

export async function seedStockCatalog(): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const spec of SAMPLE_STOCK_FROM_PRODUCTS) {
    const productId = await resolveProductId(spec);
    if (!productId) continue;

    await db.stockItem.upsert({
      where: { productId },
      create: {
        productId,
        kind: spec.kind,
        unit: spec.unit,
        active: true,
        sortOrder: spec.sortOrder,
      },
      update: {
        kind: spec.kind,
        unit: spec.unit,
        active: true,
        sortOrder: spec.sortOrder,
      },
    });
    upserted += 1;
  }
  return { upserted };
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

/** Seed 1 sample MermaEntry + 1 ConsumableCount if customers/items exist. Idempotent. */
export async function seedSampleStockEntries(): Promise<{
  merma: string | null;
  consumable: string | null;
}> {
  const entryDate = parseYmdToDate(todayYmdAr());
  let merma: string | null = null;
  let consumable: string | null = null;

  const mermaCustomer = await findFirstCustomerWithCode(MERMAS_SEED_CODES);
  if (mermaCustomer) {
    const rawBread = await db.stockItem.findMany({
      where: { active: true, kind: { in: ["RAW_MATERIAL", "BREAD"] } },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      take: 6,
      select: { id: true },
    });
    if (rawBread.length > 0) {
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
            create: rawBread.map((item, i) => ({
              stockItemId: item.id,
              qty: qtys[i % qtys.length]!,
            })),
          },
        },
      });
      merma = mermaCustomer.code;
    }
  }

  const consumableCustomer = await findFirstCustomerWithCode(
    CONSUMABLES_SEED_CODES,
  );
  if (consumableCustomer) {
    const consumables = await db.stockItem.findMany({
      where: { active: true, kind: "CONSUMABLE" },
      orderBy: [{ sortOrder: "asc" }],
      take: 5,
      select: { id: true },
    });
    if (consumables.length > 0) {
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
            create: consumables.map((item, i) => ({
              stockItemId: item.id,
              qty: qtys[i % qtys.length]!,
            })),
          },
        },
      });
      consumable = consumableCustomer.code;
    }
  }

  return { merma, consumable };
}

export async function seedStockSampleData(): Promise<{
  catalog: number;
  mermaCustomer: string | null;
  consumableCustomer: string | null;
}> {
  // Replace legacy free-text catalog + sample entries with Product-linked rows.
  await clearStockSampleData();
  const { upserted } = await seedStockCatalog();
  const entries = await seedSampleStockEntries();
  return {
    catalog: upserted,
    mermaCustomer: entries.merma,
    consumableCustomer: entries.consumable,
  };
}
