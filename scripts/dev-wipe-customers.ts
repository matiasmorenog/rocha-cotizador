/**
 * Wipe all real customer PII and transactional data from Neon development,
 * then seed deterministic fictitious customers for local/preview work.
 *
 * Preserves: products, price lists, admin users, BusinessSettings, SubscriptionPayment.
 * Deletes: customers, quotes/remitos, merma/consumables, admin inbox, module access.
 * Resets: QuoteSequence → 0 (next remito R-000001).
 *
 * Safety (fail closed — never production / Neon branch main):
 *   assertSafeDestructiveDb() blocks DATABASE_URL pointing at Neon production (branch
 *   main): known prod host, branch=main in URL, or missing SEED_TARGET=development.
 *   With SEED_TARGET=development, DATABASE_URL must be the Neon development endpoint.
 *
 * Requires:
 *   SEED_TARGET=development (set automatically by npm run dev:wipe-customers)
 *   DATABASE_URL = Neon development only (direct or pooler)
 *
 * Usage:
 *   npm run dev:wipe-customers
 *   # or: SEED_TARGET=development npx tsx scripts/dev-wipe-customers.ts
 *
 * Optional:
 *   DEV_FAKE_CUSTOMERS=minimal — only 3 general clients (001–003)
 *   DEV_FAKE_CUSTOMERS=full     — default: 12 clients covering stock module codes
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import type { CustomerModule } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import {
  BASE_PRICE_LIST_EXCEL_KEY,
  EXCEL_PRICE_LIST_DEFAULTS,
} from "../src/lib/pricing";
import { seedCustomerModuleAccess } from "../src/lib/customer-modules";
import { seedStockSampleData } from "../src/lib/stock-seed";
import { padCustomerCode, pinFromCustomerCode } from "../src/lib/utils";
import { revalidateAppCache } from "./revalidate-app-cache";

const db = new PrismaClient();

type FakeCustomerSpec = {
  code: string;
  name: string;
  /** Excel PriceList key ("5" = Precio base). */
  priceListExcelKey: string;
  modules: CustomerModule[];
  active?: boolean;
};

/** Full set — covers MERMAS_SEED_CODES + CONSUMABLES_SEED_CODES for stock dev. */
const FULL_FAKE_CUSTOMERS: FakeCustomerSpec[] = [
  { code: "001", name: "Panadería Demo Norte", priceListExcelKey: "5", modules: [] },
  { code: "002", name: "Mayorista Ficticia Sur", priceListExcelKey: "6", modules: [] },
  { code: "003", name: "Distribuidor Test Oeste", priceListExcelKey: "7", modules: [] },
  { code: "007", name: "Elaborados Demo SA", priceListExcelKey: "5", modules: ["MERMAS"] },
  { code: "047", name: "Consumibles Lab 047", priceListExcelKey: "6", modules: ["CONSUMABLES"] },
  { code: "051", name: "Sucursal Ficticia A", priceListExcelKey: "5", modules: ["CONSUMABLES"] },
  { code: "052", name: "Sucursal Ficticia B", priceListExcelKey: "8", modules: ["CONSUMABLES"] },
  { code: "077", name: "Elaborados Beta", priceListExcelKey: "7", modules: ["MERMAS"] },
  { code: "125", name: "Mermas Lab 125", priceListExcelKey: "6", modules: ["MERMAS"] },
  { code: "131", name: "Test Elaborados 131", priceListExcelKey: "5", modules: ["MERMAS"] },
  { code: "150", name: "Inventario Demo 150", priceListExcelKey: "9", modules: ["CONSUMABLES"] },
  { code: "168", name: "Branch Mermas 168", priceListExcelKey: "5", modules: ["MERMAS"] },
  { code: "172", name: "Stock Consumibles 172", priceListExcelKey: "6", modules: ["CONSUMABLES"] },
  { code: "200", name: "Elaborados Centro", priceListExcelKey: "5", modules: ["MERMAS"] },
];

const MINIMAL_FAKE_CUSTOMERS: FakeCustomerSpec[] = FULL_FAKE_CUSTOMERS.slice(0, 3);

function resolveFakeCustomerSet(): FakeCustomerSpec[] {
  const mode = (process.env.DEV_FAKE_CUSTOMERS ?? "full").trim().toLowerCase();
  if (mode === "minimal") return MINIMAL_FAKE_CUSTOMERS;
  return FULL_FAKE_CUSTOMERS;
}

function fakePhone(code: string): string {
  const n = code.replace(/\D/g, "");
  return `+54 11 4000-${n.padStart(4, "0")}`;
}

function fakeEmail(code: string): string {
  return `cliente${code.replace(/\D/g, "")}@example.dev`;
}

function fakeAddress(code: string): string {
  const n = parseInt(code, 10) || 100;
  return `Av. Ficticia ${n}, CABA`;
}

async function countBeforeWipe() {
  const [
    customers,
    quotes,
    quoteItems,
    mermaEntries,
    consumableCounts,
    inbox,
    moduleAccess,
  ] = await Promise.all([
    db.customer.count(),
    db.quote.count(),
    db.quoteItem.count(),
    db.mermaEntry.count(),
    db.consumableCount.count(),
    db.adminInboxItem.count(),
    db.customerModuleAccess.count(),
  ]);
  return {
    customers,
    quotes,
    quoteItems,
    mermaEntries,
    consumableCounts,
    inbox,
    moduleAccess,
  };
}

async function wipeCustomerDomain() {
  return db.$transaction(async (tx) => {
    const inbox = await tx.adminInboxItem.deleteMany({});
    const quoteItems = await tx.quoteItem.deleteMany({});
    const quotes = await tx.quote.deleteMany({});
    const mermaLines = await tx.mermaLine.deleteMany({});
    const mermaEntries = await tx.mermaEntry.deleteMany({});
    const consumableLines = await tx.consumableCountLine.deleteMany({});
    const consumableCounts = await tx.consumableCount.deleteMany({});
    const moduleAccess = await tx.customerModuleAccess.deleteMany({});
    const customers = await tx.customer.deleteMany({});
    await tx.quoteSequence.upsert({
      where: { id: 1 },
      create: { id: 1, value: 0 },
      update: { value: 0 },
    });
    return {
      inbox: inbox.count,
      quoteItems: quoteItems.count,
      quotes: quotes.count,
      mermaLines: mermaLines.count,
      mermaEntries: mermaEntries.count,
      consumableLines: consumableLines.count,
      consumableCounts: consumableCounts.count,
      moduleAccess: moduleAccess.count,
      customers: customers.count,
    };
  });
}

async function resolvePriceListIds(): Promise<Map<string, string>> {
  const lists = await db.priceList.findMany({
    select: { id: true, excelKey: true, isBase: true },
  });
  const map = new Map<string, string>();
  for (const list of lists) {
    if (list.excelKey) map.set(list.excelKey, list.id);
    if (list.isBase) map.set(BASE_PRICE_LIST_EXCEL_KEY, list.id);
  }
  return map;
}

async function seedFakeCustomers(specs: FakeCustomerSpec[]) {
  const listByKey = await resolvePriceListIds();
  const baseListId = listByKey.get(BASE_PRICE_LIST_EXCEL_KEY);
  if (!baseListId) {
    throw new Error(
      "Precio base PriceList missing — run db:seed or ensureExcelPriceLists first.",
    );
  }

  const pins: Array<{
    code: string;
    name: string;
    pin: string;
    priceList: string;
  }> = [];

  for (const spec of specs) {
    const code = padCustomerCode(spec.code);
    const priceListId =
      listByKey.get(spec.priceListExcelKey) ?? baseListId;
    const priceListLabel =
      spec.priceListExcelKey === BASE_PRICE_LIST_EXCEL_KEY
        ? "Precio base"
        : (EXCEL_PRICE_LIST_DEFAULTS[spec.priceListExcelKey]?.name ??
          spec.priceListExcelKey);

    const pin = pinFromCustomerCode(code);
    const passwordHash = await bcrypt.hash(pin, 10);

    const customer = await db.customer.create({
      data: {
        code,
        name: spec.name,
        nameNote: "Contacto demo",
        passwordHash,
        mustChangePassword: true,
        priceListId,
        address: fakeAddress(code),
        phone: fakePhone(code),
        email: fakeEmail(code),
        notes: "Cliente ficticio — development only. No datos reales.",
        paymentTerms: "30 días (demo)",
        deliveryHours: "08:00–12:00",
        active: spec.active ?? true,
      },
    });

    for (const module of spec.modules) {
      await db.customerModuleAccess.create({
        data: {
          customerId: customer.id,
          module,
          enabled: true,
        },
      });
    }

    pins.push({ code, name: spec.name, pin, priceList: priceListLabel });
  }

  const outDir = path.join(process.cwd(), "prisma", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "seed-pins-dev.csv");
  const csv = [
    "code,name,pin,priceList",
    ...pins.map(
      (p) =>
        `${p.code},"${p.name.replace(/"/g, '""')}",${p.pin},"${p.priceList.replace(/"/g, '""')}"`,
    ),
  ].join("\n");
  fs.writeFileSync(csvPath, `${csv}\n`, "utf8");

  return { created: pins.length, csvPath, pins };
}

async function main() {
  // Blocks Neon production / branch main — prisma/assert-safe-db.ts
  assertSafeDestructiveDb();

  const specs = resolveFakeCustomerSet();
  console.log(
    `Mode: DEV_FAKE_CUSTOMERS=${process.env.DEV_FAKE_CUSTOMERS ?? "full"} (${specs.length} clients)`,
  );

  const before = await countBeforeWipe();
  console.log("Before wipe:", before);

  const deleted = await wipeCustomerDomain();
  console.log("Deleted:", deleted);

  const seeded = await seedFakeCustomers(specs);
  console.log(`Created ${seeded.created} fictitious customers`);
  console.log(`PIN sheet: ${seeded.csvPath}`);
  console.log(
    "Login examples:",
    seeded.pins
      .slice(0, 5)
      .map((p) => `${p.code} / PIN ${p.pin}`)
      .join(", "),
  );

  const modules = await seedCustomerModuleAccess();
  console.log(
    `Module flags (seed codes present): Mermas=${modules.mermas}, Consumibles=${modules.consumables}`,
  );

  const stock = await seedStockSampleData();
  console.log(
    `Stock sample: merma=${stock.mermaCustomer ?? "n/a"} (${stock.mermaLines} lines), consumibles=${stock.consumableCustomer ?? "n/a"} (${stock.consumableLines} lines)`,
  );

  const after = await countBeforeWipe();
  console.log("After:", after);

  if (after.customers !== specs.length || after.quotes !== 0) {
    throw new Error("Post-wipe verification failed");
  }

  await revalidateAppCache();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
