import type { StockItemKind } from "@prisma/client";
import { db } from "@/lib/db";
import {
  CONSUMABLES_SEED_CODES,
  MERMAS_SEED_CODES,
} from "@/lib/customer-modules";
import type { StockUnit } from "@/lib/stock-units";
import { toArgentinaDatetimeLocal } from "@/lib/argentina-time";

type SeedStockItem = {
  code: string;
  name: string;
  kind: StockItemKind;
  unit: StockUnit;
  sortOrder: number;
};

/** Sample catalog for UI testing — idempotent upserts by code. */
export const SAMPLE_STOCK_ITEMS: SeedStockItem[] = [
  {
    code: "HARINA",
    name: "Harina 000",
    kind: "RAW_MATERIAL",
    unit: "kg",
    sortOrder: 10,
  },
  {
    code: "ACEITE",
    name: "Aceite",
    kind: "RAW_MATERIAL",
    unit: "litro",
    sortOrder: 20,
  },
  {
    code: "LEVADURA",
    name: "Levadura fresca",
    kind: "RAW_MATERIAL",
    unit: "kg",
    sortOrder: 30,
  },
  {
    code: "AZUCAR",
    name: "Azúcar",
    kind: "RAW_MATERIAL",
    unit: "kg",
    sortOrder: 40,
  },
  {
    code: "FLG",
    name: "Flauta grande",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 10,
  },
  {
    code: "FIG",
    name: "Figazza",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 20,
  },
  {
    code: "PANH",
    name: "Pan hamburguesa",
    kind: "BREAD",
    unit: "pack",
    sortOrder: 30,
  },
  {
    code: "FACT",
    name: "Facturas surtidas",
    kind: "BREAD",
    unit: "docena",
    sortOrder: 40,
  },
  {
    code: "PREPIZ",
    name: "Prepizza",
    kind: "BREAD",
    unit: "unid.",
    sortOrder: 50,
  },
  {
    code: "SERV",
    name: "Servilletas",
    kind: "CONSUMABLE",
    unit: "pack",
    sortOrder: 10,
  },
  {
    code: "VASO",
    name: "Vasos descartables",
    kind: "CONSUMABLE",
    unit: "pack",
    sortOrder: 20,
  },
  {
    code: "BOLSA",
    name: "Bolsas",
    kind: "CONSUMABLE",
    unit: "unid.",
    sortOrder: 30,
  },
  {
    code: "FILM",
    name: "Film plástico",
    kind: "CONSUMABLE",
    unit: "rollo",
    sortOrder: 40,
  },
  {
    code: "GUANTE",
    name: "Guantes",
    kind: "CONSUMABLE",
    unit: "caja",
    sortOrder: 50,
  },
];

function todayYmdAr(): string {
  return toArgentinaDatetimeLocal(new Date()).slice(0, 10);
}

function parseYmdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

export async function seedStockCatalog(): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const item of SAMPLE_STOCK_ITEMS) {
    await db.stockItem.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        kind: item.kind,
        unit: item.unit,
        active: true,
        sortOrder: item.sortOrder,
      },
      update: {
        name: item.name,
        kind: item.kind,
        unit: item.unit,
        active: true,
        sortOrder: item.sortOrder,
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

/** Seed 1 sample MermaEntry + 1 ConsumableCount if customers exist. Idempotent. */
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
    });
    if (rawBread.length > 0) {
      const qtys = [1.5, 0.5, 3, 2, 1, 0.25];
      await db.mermaEntry.upsert({
        where: {
          customerId_entryDate: {
            customerId: mermaCustomer.id,
            entryDate,
          },
        },
        create: {
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
        update: {
          notes: "Carga de prueba (seed)",
          submittedBy: "seed",
          lines: {
            deleteMany: {},
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
    });
    if (consumables.length > 0) {
      const qtys = [12, 8, 40, 2, 1];
      await db.consumableCount.upsert({
        where: {
          customerId_entryDate: {
            customerId: consumableCustomer.id,
            entryDate,
          },
        },
        create: {
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
        update: {
          notes: "Conteo de prueba (seed)",
          submittedBy: "seed",
          lines: {
            deleteMany: {},
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
  const { upserted } = await seedStockCatalog();
  const entries = await seedSampleStockEntries();
  return {
    catalog: upserted,
    mermaCustomer: entries.merma,
    consumableCustomer: entries.consumable,
  };
}
