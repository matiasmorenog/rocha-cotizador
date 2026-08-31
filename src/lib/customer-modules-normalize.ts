import type { CustomerModuleSession } from "@/types/auth";

const LEGACY_CUSTOMER_MODULE_MAP: Record<string, CustomerModuleSession> = {
  MERMAS: "DESPERDICIOS",
  ELABORADOS: "DESPERDICIOS",
  DESPERDICIOS: "DESPERDICIOS",
  CONSUMABLES: "CONSUMABLES",
  ACTIVOS: "ACTIVOS",
};

/** Map JWT/legacy enum values to current stock modules (deduped). Client-safe. */
export function normalizeCustomerModules(
  modules: readonly string[],
): CustomerModuleSession[] {
  const out = new Set<CustomerModuleSession>();
  for (const raw of modules) {
    const mapped = LEGACY_CUSTOMER_MODULE_MAP[raw];
    if (mapped) out.add(mapped);
  }
  return [...out];
}
