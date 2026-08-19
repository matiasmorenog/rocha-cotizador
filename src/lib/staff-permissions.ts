import { isSuperuserRole, SUPERUSER_LABEL } from "@/lib/platform-owner";
import type { StaffRole } from "@/types/auth";

/** Fine-grained admin UI/API gates. Derived from staff role + capability flags. */
export type StaffPermission =
  | "dashboard"
  | "customers"
  | "products"
  | "priceLists"
  | "quotes"
  | "settings"
  | "users"
  | "customerModules"
  | "stockReports"
  | "account";

const ALL_PERMISSIONS: StaffPermission[] = [
  "dashboard",
  "customers",
  "products",
  "priceLists",
  "quotes",
  "settings",
  "users",
  "customerModules",
  "stockReports",
  "account",
];

const QUOTES_BUNDLE: readonly StaffPermission[] = [
  "dashboard",
  "customers",
  "products",
  "priceLists",
  "quotes",
  "account",
];

const STOCK_BUNDLE: readonly StaffPermission[] = [
  "dashboard",
  "customers",
  "stockReports",
  "account",
];

const ROLE_PERMISSIONS: Record<StaffRole, readonly StaffPermission[]> = {
  ADMIN: ALL_PERMISSIONS,
  QUOTES: QUOTES_BUNDLE,
  STOCK: STOCK_BUNDLE,
};

export const STAFF_ROLES: readonly StaffRole[] = ["ADMIN", "QUOTES", "STOCK"];

export type StaffCapabilityProfile = {
  role: string;
  canQuotes: boolean;
  canStock: boolean;
};

export function isStaffRole(role: string | undefined | null): role is StaffRole {
  return role === "ADMIN" || role === "QUOTES" || role === "STOCK";
}

/** Email-login roles that may access /admin (Rocha staff or platform owner). */
export function isAdminPanelRole(role: string | undefined | null): boolean {
  return isStaffRole(role) || isSuperuserRole(role);
}

/** Full admin (not Cotización-/Stock-only staff). */
export function isStaffAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN";
}

/** Legacy role-only resolver (prefer permissionsForStaff). */
export function permissionsForRole(role: StaffRole): StaffPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/**
 * Resolve effective capability flags. Back-compat: rows with default false/false
 * still honor legacy QUOTES/STOCK role until backfill runs.
 */
export function resolveStaffCapabilities(
  profile: StaffCapabilityProfile,
): { canQuotes: boolean; canStock: boolean } {
  if (profile.role === "ADMIN") {
    return { canQuotes: true, canStock: true };
  }
  const hasExplicitFlag = profile.canQuotes || profile.canStock;
  if (!hasExplicitFlag && isStaffRole(profile.role)) {
    return {
      canQuotes: profile.role === "QUOTES",
      canStock: profile.role === "STOCK",
    };
  }
  return {
    canQuotes: profile.canQuotes,
    canStock: profile.canStock,
  };
}

export function permissionsForStaff(
  profile: StaffCapabilityProfile,
): StaffPermission[] {
  if (isSuperuserRole(profile.role)) {
    return [];
  }
  if (profile.role === "ADMIN") {
    return [...ALL_PERMISSIONS];
  }
  const { canQuotes, canStock } = resolveStaffCapabilities(profile);
  const set = new Set<StaffPermission>();
  if (canQuotes) {
    for (const p of QUOTES_BUNDLE) set.add(p);
  }
  if (canStock) {
    for (const p of STOCK_BUNDLE) set.add(p);
  }
  return [...set];
}

export function staffHasPermission(
  permissions: readonly StaffPermission[] | undefined | null,
  permission: StaffPermission,
): boolean {
  return permissions?.includes(permission) ?? false;
}

/** Where staff should land instead of customer routes / login. */
export function staffHomeHref(
  permissions: readonly StaffPermission[] | undefined | null,
  role?: string | null,
): "/admin/cotizaciones" | "/admin" | "/admin/plataforma" {
  if (isSuperuserRole(role)) return "/admin/plataforma";
  return staffHasPermission(permissions, "quotes")
    ? "/admin/cotizaciones"
    : "/admin";
}

/** DB / login profile → permission list. */
export function staffPermissionsFromProfile(
  profile: StaffCapabilityProfile,
): StaffPermission[] {
  return permissionsForStaff(profile);
}

export function staffSwitchesFromProfile(profile: StaffCapabilityProfile): {
  isAdmin: boolean;
  canQuotes: boolean;
  canStock: boolean;
} {
  if (profile.role === "ADMIN") {
    return { isAdmin: true, canQuotes: true, canStock: true };
  }
  const caps = resolveStaffCapabilities(profile);
  return {
    isAdmin: false,
    canQuotes: caps.canQuotes,
    canStock: caps.canStock,
  };
}

/** Persist switches → role + flags (non-admin needs at least one capability). */
export function staffFieldsFromSwitches(input: {
  isAdmin: boolean;
  canQuotes: boolean;
  canStock: boolean;
}): {
  role: StaffRole;
  canQuotes: boolean;
  canStock: boolean;
} {
  if (input.isAdmin) {
    return { role: "ADMIN", canQuotes: true, canStock: true };
  }
  const canQuotes = input.canQuotes;
  const canStock = input.canStock;
  const role: StaffRole = canQuotes ? "QUOTES" : "STOCK";
  return { role, canQuotes, canStock };
}

export function formatStaffPermissionLabels(
  profile: StaffCapabilityProfile,
): string {
  if (isSuperuserRole(profile.role)) return SUPERUSER_LABEL;
  const switches = staffSwitchesFromProfile(profile);
  if (switches.isAdmin) return "Administración";
  const parts: string[] = [];
  if (switches.canQuotes) parts.push("Cotización");
  if (switches.canStock) parts.push("Stock");
  return parts.length > 0 ? parts.join(", ") : "—";
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Administración",
  QUOTES: "Cotización",
  STOCK: "Stock",
};

/** Admin nav href → required permission (first match wins for nested paths). */
export const ADMIN_NAV_PERMISSION: Record<string, StaffPermission> = {
  "/admin": "dashboard",
  "/admin/clientes": "customers",
  "/admin/productos": "products",
  "/admin/listas-precios": "priceLists",
  "/admin/cotizaciones": "quotes",
  "/admin/configuracion": "account",
  "/admin/usuarios": "users",
  "/admin/modulos": "customerModules",
  "/admin/stock": "stockReports",
  "/admin/mermas": "stockReports",
  "/admin/consumibles": "stockReports",
  "/admin/cuenta": "account",
};
