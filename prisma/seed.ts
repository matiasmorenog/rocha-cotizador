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
import { discountFromExcelLista } from "../src/lib/pricing";
import { padCustomerCode, pinFromCustomerCode } from "../src/lib/utils";

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
  // Optional local override for seed only; never used at runtime.
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

async function seedFromExcel(xlsxPath: string) {
  const resetPins = process.env.RESET_PINS === "1";
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const pricesSheet = workbook.getWorksheet("Lista de Precios");
  if (!pricesSheet) throw new Error('Missing sheet "Lista de Precios"');

  let products = 0;
  for (let r = 5; r <= pricesSheet.rowCount; r++) {
    const row = pricesSheet.getRow(r);
    const codeRaw = cellText(row.getCell(1).value);
    if (!/^\d+$/.test(codeRaw)) continue;

    const code = codeRaw.padStart(4, "0");
    const rubro = cellText(row.getCell(2).value) || null;
    const name = cellText(row.getCell(3).value);
    const basePrice = cellNumber(row.getCell(5).value); // Mayorista (lista 5)

    if (!name || basePrice <= 0) continue;

    await db.product.upsert({
      where: { code },
      create: { code, name, rubro, basePrice, active: true },
      update: { name, rubro, basePrice, active: true },
    });
    products += 1;
  }
  console.log(`Products upserted: ${products}`);

  const clientsSheet = workbook.getWorksheet("Lista Clientes");
  if (!clientsSheet) throw new Error('Missing sheet "Lista Clientes"');

  const pins: Array<{ code: string; name: string; pin: string; discountPercent: number }> = [];
  let customers = 0;

  for (let r = 3; r <= clientsSheet.rowCount; r++) {
    const row = clientsSheet.getRow(r);
    const codeRaw = cellText(row.getCell(1).value);
    if (!/^\d+$/.test(codeRaw)) continue;

    const code = padCustomerCode(codeRaw);
    const name = cellText(row.getCell(2).value);
    if (!name) continue;

    const lista = cellText(row.getCell(3).value);
    const discountPercent = discountFromExcelLista(lista);
    const address = cellText(row.getCell(4).value) || null;
    // F Comentarios + N Reparto (reuse notes; no schema field)
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
    // H CC/Contado, I Forma de Pago, J Forma (Efectivo); K Factura / L Tipo when set
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
        discountPercent,
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
        discountPercent,
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
      pins.push({ code, name: customerName, pin, discountPercent });
    }
    customers += 1;
  }

  console.log(`Customers upserted: ${customers}`);

  const outDir = path.join(process.cwd(), "prisma", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "seed-pins.csv");

  if (pins.length > 0) {
    const csv = [
      "code,name,pin,discountPercent",
      ...pins.map(
        (p) =>
          `${p.code},"${p.name.replace(/"/g, '""')}",${p.pin},${p.discountPercent}`,
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

async function main() {
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
    return;
  }
  await seedFromExcel(xlsxPath);
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
