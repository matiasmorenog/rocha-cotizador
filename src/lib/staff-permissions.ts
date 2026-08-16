import type { StaffRole } from "@/types/auth";

/** Fine-grained admin UI/API gates. Derived from primary staff role. */
export type StaffPermission =
  | "dashboard"
  | "customers"
  | "products"
  | "priceLists"
  | "quotes"
  | "settings"
  | "users"
  | "customerModules"
  | "stockCatalog"
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
  "stockCatalog",
  "stockReports",
  "account",
];

const ROLE_PERMISSIONS: Record<StaffRole, readonly StaffPermission[]> = {
  ADMIN: ALL_PERMISSIONS,
  QUOTES: [
    "dashboard",
    "customers",
    "products",
    "priceLists",
    "quotes",
    "account",
  ],
  STOCK: [
    "dashboard",
    "customers",
    "stockCatalog",
    "stockReports",
    "account",
  ],
};

export const STAFF_ROLES: readonly StaffRole[] = ["ADMIN", "QUOTES", "STOCK"];

export function isStaffRole(role: string | undefined | null): role is StaffRole {
  return role === "ADMIN" || role === "QUOTES" || role === "STOCK";
}

export function permissionsForRole(role: StaffRole): StaffPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function staffHasPermission(
  role: string | undefined | null,
  permission: StaffPermission,
): boolean {
  if (!isStaffRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
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
  "/admin/configuracion": "settings",
  "/admin/usuarios": "users",
  "/admin/modulos": "customerModules",
  "/admin/stock": "stockCatalog",
  "/admin/mermas": "stockReports",
  "/admin/consumibles": "stockReports",
  "/admin/cuenta": "account",
};
