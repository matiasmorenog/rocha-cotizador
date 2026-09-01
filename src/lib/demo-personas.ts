import type { CustomerModule } from "@prisma/client";

/** Shared PIN for all demo customers (seed + optional manual login). */
export const DEMO_CUSTOMER_PIN = "1234";

/** Staff demo password — seed only; never exposed in UI. */
export const DEMO_STAFF_PASSWORD = "demo1234";

/** Reserved customer codes 900–909 — demo login allowlist. */
export const DEMO_CUSTOMER_CODE_MIN = 900;
export const DEMO_CUSTOMER_CODE_MAX = 909;

export type DemoPersonaKind = "customer" | "staff";

export type DemoCustomerSpec = {
  kind: "customer";
  id: string;
  code: string;
  name: string;
  label: string;
  description: string;
  priceListExcelKey: string;
  modules: CustomerModule[];
  mustChangePassword?: boolean;
  active?: boolean;
};

export type DemoStaffSpec = {
  kind: "staff";
  id: string;
  email: string;
  name: string;
  label: string;
  description: string;
  role: "ADMIN" | "QUOTES" | "STOCK" | "SUPERUSER";
  canQuotes: boolean;
  canStock: boolean;
};

export type DemoPersonaSpec = DemoCustomerSpec | DemoStaffSpec;

export const DEMO_PERSONAS: DemoPersonaSpec[] = [
  {
    kind: "customer",
    id: "demo-customer-base",
    code: "900",
    name: "Demo — Lista base",
    label: "Cliente · lista base",
    description: "Cotización con Precio base, sin módulos stock.",
    priceListExcelKey: "5",
    modules: [],
    mustChangePassword: false,
  },
  {
    kind: "customer",
    id: "demo-customer-list-20",
    code: "901",
    name: "Demo — Lista 20%",
    label: "Cliente · lista 20% dto",
    description: "Precios con Lista 20% dto.",
    priceListExcelKey: "6",
    modules: [],
    mustChangePassword: false,
  },
  {
    kind: "customer",
    id: "demo-customer-desperdicios",
    code: "902",
    name: "Demo — Desperdicios",
    label: "Cliente · desperdicios",
    description: "Cotización + recuento de desperdicios.",
    priceListExcelKey: "5",
    modules: ["DESPERDICIOS"],
    mustChangePassword: false,
  },
  {
    kind: "customer",
    id: "demo-customer-consumibles",
    code: "903",
    name: "Demo — Consumibles",
    label: "Cliente · consumibles",
    description: "Cotización + stock consumibles.",
    priceListExcelKey: "5",
    modules: ["CONSUMABLES"],
    mustChangePassword: false,
  },
  {
    kind: "customer",
    id: "demo-customer-stock-full",
    code: "904",
    name: "Demo — Desperdicios + consumibles",
    label: "Cliente · ambos módulos stock",
    description: "Desperdicios y consumibles habilitados.",
    priceListExcelKey: "7",
    modules: ["DESPERDICIOS", "CONSUMABLES"],
    mustChangePassword: false,
  },
  {
    kind: "customer",
    id: "demo-customer-activos",
    code: "905",
    name: "Demo — Activos del local",
    label: "Cliente · activos del local",
    description: "Módulo activos del local (recuento mensual).",
    priceListExcelKey: "5",
    modules: ["ACTIVOS"],
    mustChangePassword: false,
  },
  {
    kind: "customer",
    id: "demo-customer-change-pw",
    code: "906",
    name: "Demo — Primer acceso",
    label: "Cliente · cambio de contraseña",
    description: "Flujo mustChangePassword (PIN 1234, luego Configuración).",
    priceListExcelKey: "5",
    modules: [],
    mustChangePassword: true,
  },
  {
    kind: "staff",
    id: "demo-staff-admin",
    email: "demo-admin@rocha.dev",
    name: "Demo Admin",
    label: "Admin · completo",
    description: "Panel admin con cotización y stock.",
    role: "ADMIN",
    canQuotes: true,
    canStock: true,
  },
  {
    kind: "staff",
    id: "demo-staff-quotes",
    email: "demo-quotes@rocha.dev",
    name: "Demo Cotización",
    label: "Staff · solo cotización",
    description: "Productos, listas y cotizaciones.",
    role: "QUOTES",
    canQuotes: true,
    canStock: false,
  },
  {
    kind: "staff",
    id: "demo-staff-stock",
    email: "demo-stock@rocha.dev",
    name: "Demo Stock",
    label: "Staff · solo stock",
    description: "Desperdicios y consumibles.",
    role: "STOCK",
    canQuotes: false,
    canStock: true,
  },
  {
    kind: "staff",
    id: "demo-staff-mixed",
    email: "demo-mixed@rocha.dev",
    name: "Demo Cotización + Stock",
    label: "Staff · cotización + stock",
    description: "Rol QUOTES con ambos módulos habilitados.",
    role: "QUOTES",
    canQuotes: true,
    canStock: true,
  },
  {
    kind: "staff",
    id: "demo-staff-super",
    email: "demo-super@rocha.dev",
    name: "Demo Superusuario",
    label: "Superusuario",
    description: "Acceso total + vista previa de roles staff.",
    role: "SUPERUSER",
    canQuotes: false,
    canStock: false,
  },
];

export function getDemoPersonaById(id: string): DemoPersonaSpec | undefined {
  return DEMO_PERSONAS.find((p) => p.id === id);
}

export function isDemoCustomerCode(code: string): boolean {
  const n = parseInt(code, 10);
  return (
    Number.isFinite(n) &&
    n >= DEMO_CUSTOMER_CODE_MIN &&
    n <= DEMO_CUSTOMER_CODE_MAX
  );
}

export function isDemoStaffEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return DEMO_PERSONAS.some(
    (p) => p.kind === "staff" && p.email.toLowerCase() === normalized,
  );
}

export function demoPersonasForUi(
  kind: "customer" | "staff" | "all",
): DemoPersonaSpec[] {
  if (kind === "all") return DEMO_PERSONAS;
  return DEMO_PERSONAS.filter((p) => p.kind === kind);
}
