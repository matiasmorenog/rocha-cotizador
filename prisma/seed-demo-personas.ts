import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import {
  BASE_PRICE_LIST_EXCEL_KEY,
  EXCEL_PRICE_LIST_DEFAULTS,
} from "../src/lib/pricing";
import {
  DEMO_CUSTOMER_PIN,
  DEMO_PERSONAS,
  DEMO_STAFF_PASSWORD,
  type DemoCustomerSpec,
  type DemoStaffSpec,
} from "../src/lib/demo-personas";
import { padCustomerCode } from "../src/lib/utils";

async function resolvePriceListIds(
  db: PrismaClient,
): Promise<Map<string, string>> {
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

async function upsertDemoCustomer(
  db: PrismaClient,
  spec: DemoCustomerSpec,
  listByKey: Map<string, string>,
  passwordHash: string,
) {
  const code = padCustomerCode(spec.code);
  const baseListId = listByKey.get(BASE_PRICE_LIST_EXCEL_KEY);
  if (!baseListId) {
    throw new Error(
      "Precio base PriceList missing — run catalog seed before demo personas.",
    );
  }
  const priceListId = listByKey.get(spec.priceListExcelKey) ?? baseListId;

  const customer = await db.customer.upsert({
    where: { code },
    create: {
      code,
      name: spec.name,
      nameNote: "Persona demo",
      passwordHash,
      mustChangePassword: spec.mustChangePassword ?? false,
      priceListId,
      address: `Av. Demo ${code}, CABA`,
      phone: `+54 11 5900-${code}`,
      email: `demo-cliente-${code}@rocha.dev`,
      notes: "Cliente demo — development / portfolio preview only.",
      paymentTerms: "30 días (demo)",
      deliveryHours: "08:00–12:00",
      active: spec.active ?? true,
    },
    update: {
      name: spec.name,
      passwordHash,
      mustChangePassword: spec.mustChangePassword ?? false,
      priceListId,
      active: spec.active ?? true,
      notes: "Cliente demo — development / portfolio preview only.",
    },
  });

  for (const module of ["DESPERDICIOS", "CONSUMABLES", "ACTIVOS"] as const) {
    const enabled = spec.modules.includes(module);
    await db.customerModuleAccess.upsert({
      where: {
        customerId_module: { customerId: customer.id, module },
      },
      create: {
        customerId: customer.id,
        module,
        enabled,
      },
      update: { enabled },
    });
  }

  return code;
}

async function upsertDemoStaff(
  db: PrismaClient,
  spec: DemoStaffSpec,
  passwordHash: string,
) {
  const email = spec.email.toLowerCase();
  await db.user.upsert({
    where: { email },
    create: {
      email,
      name: spec.name,
      passwordHash,
      role: spec.role,
      canQuotes: spec.canQuotes,
      canStock: spec.canStock,
      isSuperuser: spec.role === "SUPERUSER",
      active: true,
    },
    update: {
      name: spec.name,
      passwordHash,
      role: spec.role,
      canQuotes: spec.canQuotes,
      canStock: spec.canStock,
      isSuperuser: spec.role === "SUPERUSER",
      active: true,
    },
  });
}

/**
 * Upsert stable demo customers (900–906) and staff users for portfolio / dev testing.
 * Idempotent — safe on every seed run.
 */
export async function seedDemoPersonas(db: PrismaClient): Promise<{
  customers: number;
  staff: number;
}> {
  const listByKey = await resolvePriceListIds(db);
  const customerPinHash = await bcrypt.hash(DEMO_CUSTOMER_PIN, 10);
  const staffPasswordHash = await bcrypt.hash(DEMO_STAFF_PASSWORD, 10);

  let customers = 0;
  let staff = 0;

  for (const persona of DEMO_PERSONAS) {
    if (persona.kind === "customer") {
      await upsertDemoCustomer(db, persona, listByKey, customerPinHash);
      customers += 1;
      continue;
    }
    await upsertDemoStaff(db, persona, staffPasswordHash);
    staff += 1;
  }

  const listKeys = [
    ...new Set(
      DEMO_PERSONAS.filter((p) => p.kind === "customer").map(
        (p) => p.priceListExcelKey,
      ),
    ),
  ];
  const missingLists = listKeys.filter((k) => !listByKey.has(k));
  if (missingLists.length > 0) {
    console.warn(
      `Demo personas: missing PriceLists for excelKey(s) ${missingLists.join(", ")} — those clients fall back to Precio base.`,
    );
  }

  const labels = listKeys
    .map((k) => EXCEL_PRICE_LIST_DEFAULTS[k]?.name ?? k)
    .join(", ");
  console.log(
    `Demo personas ready: ${customers} customers (PIN ${DEMO_CUSTOMER_PIN}, codes 900–906), ${staff} staff (@rocha.dev, password in seed only). Lists: ${labels || "base"}`,
  );

  return { customers, staff };
}
