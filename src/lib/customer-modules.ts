import type { CustomerModule } from "@prisma/client";
import { db } from "@/lib/db";

export type { CustomerModule };

export const CUSTOMER_MODULE_LABELS: Record<CustomerModule, string> = {
  MERMAS: "Bajas del día",
  CONSUMABLES: "Consumibles",
  ACTIVOS: "Activos del local",
};

export const CUSTOMER_MODULES: CustomerModule[] = [
  "MERMAS",
  "CONSUMABLES",
  "ACTIVOS",
];

export type CustomerModuleFlags = Record<CustomerModule, boolean>;

export const DEFAULT_CUSTOMER_MODULE_FLAGS: CustomerModuleFlags = {
  MERMAS: false,
  CONSUMABLES: false,
  ACTIVOS: false,
};

export function modulesFromAccess(
  rows: { module: CustomerModule; enabled: boolean }[],
): CustomerModuleFlags {
  return {
    MERMAS: Boolean(
      rows.find((m) => m.module === "MERMAS" && m.enabled),
    ),
    CONSUMABLES: Boolean(
      rows.find((m) => m.module === "CONSUMABLES" && m.enabled),
    ),
    ACTIVOS: Boolean(
      rows.find((m) => m.module === "ACTIVOS" && m.enabled),
    ),
  };
}

export async function syncCustomerModuleFlags(
  customerId: string,
  flags: CustomerModuleFlags,
): Promise<void> {
  for (const customerModule of CUSTOMER_MODULES) {
    await db.customerModuleAccess.upsert({
      where: {
        customerId_module: { customerId, module: customerModule },
      },
      create: {
        customerId,
        module: customerModule,
        enabled: flags[customerModule],
      },
      update: { enabled: flags[customerModule] },
    });
  }
}

/** Seed codes that should have Mermas enabled. */
export const MERMAS_SEED_CODES = [
  "007",
  "077",
  "200",
  "125",
  "168",
  "131",
] as const;

/** Seed codes that should have Consumibles enabled. */
export const CONSUMABLES_SEED_CODES = [
  "150",
  "172",
  "051",
  "052",
  "047",
] as const;

export async function getEnabledModulesForCustomer(
  customerId: string,
): Promise<CustomerModule[]> {
  const rows = await db.customerModuleAccess.findMany({
    where: { customerId, enabled: true },
    select: { module: true },
  });
  return rows.map((r) => r.module);
}

export async function customerHasModule(
  customerId: string,
  module: CustomerModule,
): Promise<boolean> {
  const row = await db.customerModuleAccess.findUnique({
    where: { customerId_module: { customerId, module } },
    select: { enabled: true },
  });
  return Boolean(row?.enabled);
}

/** Upsert enabled flags for the known seed customer codes. Idempotent. */
export async function seedCustomerModuleAccess(): Promise<{
  mermas: number;
  consumables: number;
}> {
  let mermas = 0;
  let consumables = 0;

  for (const code of MERMAS_SEED_CODES) {
    const customer = await db.customer.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!customer) continue;
    await db.customerModuleAccess.upsert({
      where: {
        customerId_module: { customerId: customer.id, module: "MERMAS" },
      },
      create: {
        customerId: customer.id,
        module: "MERMAS",
        enabled: true,
      },
      update: { enabled: true },
    });
    mermas += 1;
  }

  for (const code of CONSUMABLES_SEED_CODES) {
    const customer = await db.customer.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!customer) continue;
    await db.customerModuleAccess.upsert({
      where: {
        customerId_module: {
          customerId: customer.id,
          module: "CONSUMABLES",
        },
      },
      create: {
        customerId: customer.id,
        module: "CONSUMABLES",
        enabled: true,
      },
      update: { enabled: true },
    });
    consumables += 1;
  }

  return { mermas, consumables };
}
