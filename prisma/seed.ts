import "dotenv/config";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  appendContactToName,
  parsePhoneContact,
} from "../src/lib/phone-contact";
import {
  BASE_PRICE_LIST_EXCEL_KEY,
  BASE_PRICE_LIST_NAME,
  EXCEL_PRICE_LIST_DEFAULTS,
  excelListaToPriceListKey,
} from "../src/lib/pricing";
import {
  UNIT_ORDER_PRODUCT_CODES,
  productAllowsUnitOrderByCode,
} from "../src/lib/unit-order-products";
import { padCustomerCode, pinFromCustomerCode } from "../src/lib/utils";
import { seedCustomerModuleAccess } from "../src/lib/customer-modules";
import { seedStockSampleData } from "../src/lib/stock-seed";
import { assertSafeDestructiveDb } from "./assert-safe-db";

const db = new PrismaClient();

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text ?? "");
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function cellNumber(value: ExcelJS.CellValue): number {
  if (value !== null && typeof value === "object" && "result" in value) {
    const r = (value as { result?: unknown }).result;
    if (typeof r === "number" && Number.isFinite(r)) return r;
    return cellNumber(r as ExcelJS.CellValue);
  }
  const raw = cellText(value).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Join non-empty parts with a separator (Excel payment / notes fields). */
function joinParts(parts: Array<string | null | undefined>, sep = " / "): string | null {
  const cleaned = parts.map((p) => (p ?? "").trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(sep) : null;
}

/** Bootstrap admin — email lives in DB only; change password after first login. */
const DEFAULT_ADMIN_EMAIL = "admin@rocha.com";
const DEFAULT_ADMIN_PASSWORD = "admin1234";

async function seedAdmin() {
  const email = DEFAULT_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  await db.user.upsert({
    where: { email },
    create: {
      email,
      name: "Administrador",
      passwordHash,
      role: "ADMIN",
    },
    update: {
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin ready: ${email}`);
}

/**
 * Ensure singleton Precio base list (excelKey 5, isBase true).
 * Clears isBase on any other list.
 */
async function ensureBasePriceList(): Promise<string> {
  await db.priceList.updateMany({
    where: { isBase: true, NOT: { excelKey: BASE_PRICE_LIST_EXCEL_KEY } },
    data: { isBase: false },
  });

  const list = await db.priceList.upsert({
    where: { excelKey: BASE_PRICE_LIST_EXCEL_KEY },
    create: {
      name: BASE_PRICE_LIST_NAME,
      excelKey: BASE_PRICE_LIST_EXCEL_KEY,
      isBase: true,
      active: true,
    },
    update: {
      isBase: true,
      // Keep admin rename; only set name if still default-ish empty
    },
  });

  // If name was never customized away from old labels, normalize to Precio base
  if (
    list.name === "Mayorista" ||
    list.name === "Mayorista (base)" ||
    list.name === "Minorista" ||
    list.name === "Minorista (base)"
  ) {
    await db.priceList.update({
      where: { id: list.id },
      data: { name: BASE_PRICE_LIST_NAME },
    });
  }

  return list.id;
}

/** Ensure Excel-backed discount price lists exist; return excelKey → id (includes base). */
async function ensureExcelPriceLists(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const baseId = await ensureBasePriceList();
  map.set(BASE_PRICE_LIST_EXCEL_KEY, baseId);

  for (const [excelKey, meta] of Object.entries(EXCEL_PRICE_LIST_DEFAULTS)) {
    const list = await db.priceList.upsert({
      where: { excelKey },
      create: { name: meta.name, excelKey, active: true, isBase: false },
      update: { isBase: false },
    });
    map.set(excelKey, list.id);
  }
  return map;
}

/**
 * Drop legacy Excel PriceList excelKey "4" (Minorista) — not a real discount list.
 * Customers on that list → Precio base list id.
 */
async function removeOrphanExcelMinoristaList(baseListId: string) {
  const orphan = await db.priceList.findUnique({ where: { excelKey: "4" } });
  if (!orphan) return;
  if (orphan.isBase || orphan.id === baseListId) return;

  const customersMoved = await db.customer.updateMany({
    where: { priceListId: orphan.id },
    data: { priceListId: baseListId },
  });
  const itemsDeleted = await db.priceListItem.deleteMany({
    where: { priceListId: orphan.id },
  });
  await db.priceList.delete({ where: { id: orphan.id } });
  console.log(
    `Removed orphan PriceList excelKey=4 ("${orphan.name}"): ${itemsDeleted.count} items, ${customersMoved.count} customers → Precio base`,
  );
}

/** Reassign null priceListId customers to base list. */
async function assignNullCustomersToBase(baseListId: string) {
  const result = await db.customer.updateMany({
    where: { priceListId: null },
    data: { priceListId: baseListId },
  });
  if (result.count > 0) {
    console.log(`Customers with null list → Precio base: ${result.count}`);
  }
}

async function seedFromExcel(xlsxPath: string) {
  const resetPins = process.env.RESET_PINS === "1";
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const pricesSheet = workbook.getWorksheet("Lista de Precios");
  if (!pricesSheet) throw new Error('Missing sheet "Lista de Precios"');

  const listByKey = await ensureExcelPriceLists();
  const baseListId = listByKey.get(BASE_PRICE_LIST_EXCEL_KEY)!;
  await removeOrphanExcelMinoristaList(baseListId);
  console.log(`Price lists ready: ${[...listByKey.keys()].join(", ")}`);

  let products = 0;
  let listItems = 0;
  const productRows: Array<{
    code: string;
    name: string;
    rubro: string | null;
    basePrice: number;
    listPrices: Record<string, number>;
  }> = [];

  for (let r = 5; r <= pricesSheet.rowCount; r++) {
    const row = pricesSheet.getRow(r);
    const codeRaw = cellText(row.getCell(1).value);
    if (!/^\d+$/.test(codeRaw)) continue;

    const code = codeRaw.padStart(4, "0");
    const rubro = cellText(row.getCell(2).value) || null;
    const name = cellText(row.getCell(3).value);
    // Col 5 (Excel "Mayorista") → Product.basePrice + base list item.
    // Col 4 ("Minorista") ignored — not a PriceList.
    // Allow basePrice 0 only for unit-order SKUs (yellow LPM); other $0 rows
    // are placeholders and must stay out of the catalog.
    const basePrice = cellNumber(row.getCell(5).value);
    const allowsUnitOrder = productAllowsUnitOrderByCode(code);

    if (!name || basePrice < 0) continue;
    if (basePrice === 0 && !allowsUnitOrder) continue;

    const listPrices: Record<string, number> = {
      [BASE_PRICE_LIST_EXCEL_KEY]: basePrice,
    };
    for (const [excelKey, meta] of Object.entries(EXCEL_PRICE_LIST_DEFAULTS)) {
      const unitPrice = cellNumber(row.getCell(meta.column).value);
      if (unitPrice > 0) listPrices[excelKey] = unitPrice;
    }
    productRows.push({ code, name, rubro, basePrice, listPrices });
  }

  const CHUNK = 25;
  for (let i = 0; i < productRows.length; i += CHUNK) {
    const chunk = productRows.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (row) => {
        const allowsUnitOrder = productAllowsUnitOrderByCode(row.code);
        const product = await db.product.upsert({
          where: { code: row.code },
          create: {
            code: row.code,
            name: row.name,
            rubro: row.rubro,
            basePrice: row.basePrice,
            allowsUnitOrder,
            active: true,
          },
          update: {
            name: row.name,
            rubro: row.rubro,
            basePrice: row.basePrice,
            allowsUnitOrder,
            active: true,
          },
        });

        const itemKeys = Object.entries(row.listPrices);
        await Promise.all(
          itemKeys.map(async ([excelKey, unitPrice]) => {
            const priceListId = listByKey.get(excelKey);
            if (!priceListId) return;
            await db.priceListItem.upsert({
              where: {
                priceListId_productId: { priceListId, productId: product.id },
              },
              create: { priceListId, productId: product.id, unitPrice },
              update: { unitPrice },
            });
          }),
        );
        return { products: 1, items: itemKeys.length };
      }),
    );
    for (const r of results) {
      products += r.products;
      listItems += r.items;
    }
  }
  console.log(`Products upserted: ${products}; price list items: ${listItems}`);
  await seedUnitOrderFlags();

  const clientsSheet = workbook.getWorksheet("Lista Clientes");
  if (!clientsSheet) throw new Error('Missing sheet "Lista Clientes"');

  const pins: Array<{ code: string; name: string; pin: string; priceList: string }> = [];
  let customers = 0;

  for (let r = 3; r <= clientsSheet.rowCount; r++) {
    const row = clientsSheet.getRow(r);
    const codeRaw = cellText(row.getCell(1).value);
    if (!/^\d+$/.test(codeRaw)) continue;

    const code = padCustomerCode(codeRaw);
    const name = cellText(row.getCell(2).value);
    if (!name) continue;

    const lista = cellText(row.getCell(3).value);
    const excelKey = excelListaToPriceListKey(lista);
    const priceListId = listByKey.get(excelKey) ?? baseListId;
    const priceListLabel =
      excelKey === BASE_PRICE_LIST_EXCEL_KEY
        ? BASE_PRICE_LIST_NAME
        : (EXCEL_PRICE_LIST_DEFAULTS[excelKey]?.name ?? excelKey);

    const address = cellText(row.getCell(4).value) || null;
    const comments = cellText(row.getCell(6).value);
    const reparto = cellText(row.getCell(14).value);
    const notes = joinParts(
      [comments, reparto ? `Reparto: ${reparto}` : null],
      " | ",
    );
    const { phone, email, contact } = parsePhoneContact(
      cellText(row.getCell(7).value),
    );
    const customerName = contact ? appendContactToName(name, contact) : name;
    const factura = cellText(row.getCell(11).value);
    const tipo = cellText(row.getCell(12).value);
    const paymentTerms = joinParts([
      cellText(row.getCell(8).value),
      cellText(row.getCell(9).value),
      cellText(row.getCell(10).value),
      factura ? `Factura: ${factura}` : null,
      tipo ? `Tipo ${tipo}` : null,
    ]);
    const deliveryHours = cellText(row.getCell(13).value) || null;

    const existing = await db.customer.findUnique({ where: { code } });
    let pin: string | null = null;
    let passwordHash: string;

    if (existing && !resetPins) {
      passwordHash = existing.passwordHash;
    } else {
      pin = pinFromCustomerCode(code);
      passwordHash = await bcrypt.hash(pin, 10);
    }

    await db.customer.upsert({
      where: { code },
      create: {
        code,
        name: customerName,
        passwordHash,
        mustChangePassword: true,
        priceListId,
        address,
        phone,
        email,
        notes,
        paymentTerms,
        deliveryHours,
        active: true,
      },
      update: {
        name: customerName,
        priceListId,
        address,
        phone,
        email,
        notes,
        paymentTerms,
        deliveryHours,
        active: true,
        ...(resetPins
          ? { passwordHash, mustChangePassword: true }
          : {}),
      },
    });

    if (pin) {
      pins.push({ code, name: customerName, pin, priceList: priceListLabel });
    }
    customers += 1;
  }

  await assignNullCustomersToBase(baseListId);

  console.log(`Customers upserted: ${customers}`);

  const outDir = path.join(process.cwd(), "prisma", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "seed-pins.csv");

  if (pins.length > 0) {
    const csv = [
      "code,name,pin,priceList",
      ...pins.map(
        (p) =>
          `${p.code},"${p.name.replace(/"/g, '""')}",${p.pin},"${p.priceList.replace(/"/g, '""')}"`,
      ),
    ].join("\n");
    fs.writeFileSync(csvPath, csv, "utf8");
    console.log(`PIN sheet written: ${csvPath} (${pins.length} new/reset PINs)`);
  } else {
    console.log(
      "No new PINs generated (existing customers kept). Set RESET_PINS=1 to regenerate all.",
    );
  }
}

async function seedBusinessSettings() {
  await db.businessSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      whatsappNotifyPhone: "5491166904442",
    },
    update: {},
  });
  console.log("Business settings ready (WhatsApp notify default)");
}

/** Excel LPM yellow products — allow unit OR kg orders (price TBD after weigh). */
async function seedUnitOrderFlags() {
  const codes = [...UNIT_ORDER_PRODUCT_CODES];
  const result = await db.product.updateMany({
    where: { code: { in: codes } },
    data: { allowsUnitOrder: true },
  });
  console.log(
    `Unit-order flag ON for ${result.count}/${codes.length} yellow LPM codes`,
  );
}

async function main() {
  assertSafeDestructiveDb();

  await db.quoteSequence.upsert({
    where: { id: 1 },
    create: { id: 1, value: 0 },
    update: {},
  });

  await seedBusinessSettings();
  await seedAdmin();

  const xlsxPath = path.join(process.cwd(), "prisma", "data", "rocha_data.xlsx");
  if (!fs.existsSync(xlsxPath)) {
    console.warn(`Excel not found at ${xlsxPath} — skipping catalog seed`);
    await seedUnitOrderFlags();
    const modules = await seedCustomerModuleAccess();
    console.log(
      `Customer modules: Mermas=${modules.mermas}, Consumibles=${modules.consumables}`,
    );
    const stock = await seedStockSampleData();
    console.log(
      `Stock sample: catalog=${stock.catalog}, merma=${stock.mermaCustomer ?? "n/a"}, consumibles=${stock.consumableCustomer ?? "n/a"}`,
    );
    return;
  }
  await seedFromExcel(xlsxPath);
  const modules = await seedCustomerModuleAccess();
  console.log(
    `Customer modules: Mermas=${modules.mermas}, Consumibles=${modules.consumables}`,
  );
  const stock = await seedStockSampleData();
  console.log(
    `Stock sample: catalog=${stock.catalog}, merma=${stock.mermaCustomer ?? "n/a"}, consumibles=${stock.consumableCustomer ?? "n/a"}`,
  );
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
