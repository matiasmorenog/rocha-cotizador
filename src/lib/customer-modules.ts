import type { CustomerModule } from "@prisma/client";
import { db } from "@/lib/db";
import { ENTITY_ENABLED_FEMININE_LABELS } from "@/lib/entity-status-labels";
import { normalizeCustomerModules } from "@/lib/customer-modules-normalize";
import type { CustomerModuleSession } from "@/types/auth";

export type { CustomerModule };
export { normalizeCustomerModules };

function tokenModulesNeedRefresh(modules: readonly string[]): boolean {
  if (modules.length === 0) return true;
  return modules.some((m) => m === "MERMAS" || m === "ELABORADOS");
}

/** Prefer JWT modules; refetch from DB when empty or legacy MERMAS/ELABORADOS. */
export async function resolveCustomerModulesForSession(
  customerId: string,
  tokenModules: unknown,
): Promise<CustomerModuleSession[]> {
  const raw = Array.isArray(tokenModules)
    ? tokenModules.filter((m): m is string => typeof m === "string")
    : [];
  const normalized = normalizeCustomerModules(raw);
  if (!tokenModulesNeedRefresh(raw)) return normalized;
  try {
    return normalizeCustomerModules(
      await getEnabledModulesForCustomer(customerId),
    );
  } catch {
    return normalized;
  }
}

export const CUSTOMER_MODULE_LABELS: Record<CustomerModule, string> = {
  DESPERDICIOS: "Desperdicios",
  CONSUMABLES: "Consumibles",
  ACTIVOS: "Activos del local",
};

export const CUSTOMER_MODULE_DESCRIPTIONS: Record<CustomerModule, string> = {
  DESPERDICIOS:
    "Panes, masas y comida que se tira al cierre del día porque no se vende al día siguiente.",
  CONSUMABLES:
    "Gaseosas, insumos y stock invertido. No son desperdicios de elaborados.",
  ACTIVOS:
    "Carritos, bandejas y otros activos del local. El recuento puede ser mensual u otro día.",
};

/** Customer.account access flag — not the ACTIVOS stock module. */
export const CUSTOMER_ACCOUNT_STATUS_LABELS = ENTITY_ENABLED_FEMININE_LABELS;

export const CUSTOMER_MODULES: CustomerModule[] = [
  "DESPERDICIOS",
  "CONSUMABLES",
  "ACTIVOS",
];

export type CustomerModuleFlags = Record<CustomerModule, boolean>;

export const DEFAULT_CUSTOMER_MODULE_FLAGS: CustomerModuleFlags = {
  DESPERDICIOS: false,
  CONSUMABLES: false,
  ACTIVOS: false,
};

export function modulesFromAccess(
  rows: { module: CustomerModule; enabled: boolean }[],
): CustomerModuleFlags {
  return {
    DESPERDICIOS: Boolean(
      rows.find((m) => m.module === "DESPERDICIOS" && m.enabled),
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

/** Seed codes that should have Desperdicios enabled. */
export const DESPERDICIOS_SEED_CODES = [
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
  desperdicios: number;
  consumables: number;
}> {
  let desperdicios = 0;
  let consumables = 0;

  for (const code of DESPERDICIOS_SEED_CODES) {
    const customer = await db.customer.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!customer) continue;
    await db.customerModuleAccess.upsert({
      where: {
        customerId_module: { customerId: customer.id, module: "DESPERDICIOS" },
      },
      create: {
        customerId: customer.id,
        module: "DESPERDICIOS",
        enabled: true,
      },
      update: { enabled: true },
    });
    desperdicios += 1;
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

  return { desperdicios, consumables };
}
