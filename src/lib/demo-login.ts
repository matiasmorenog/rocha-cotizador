import {
  DEMO_CUSTOMER_CODE_MAX,
  DEMO_CUSTOMER_CODE_MIN,
  getDemoPersonaById,
  isDemoCustomerCode,
  isDemoStaffEmail,
} from "@/lib/demo-personas";

const PROD_HOST_MARKERS = [
  "ep-cool-mud-a6k5vosf",
  ...(process.env.NEON_PROD_HOST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  ...(process.env.PRODUCTION_DATABASE_HOST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
];

function envFlagOn(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function databaseHost(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  try {
    const withProtocol = url.replace(/^postgresql:/i, "http:");
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Fail closed if DATABASE_URL looks like Neon production / main. */
export function isProductionDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL?.trim().toLowerCase() ?? "";
  const host = databaseHost();
  if (
    url.includes("branch=main") ||
    url.includes("branch%3dmain")
  ) {
    return true;
  }
  if (!host) return true;
  return PROD_HOST_MARKERS.some((m) => host.includes(m));
}

/** Server-side: demo auth provider + API routes. */
export function isDemoLoginEnabled(): boolean {
  if (!envFlagOn(process.env.DEMO_LOGIN_ENABLED)) return false;
  if (isProductionDatabaseUrl()) return false;
  return true;
}

/** Client bundle: show demo UI (build-time NEXT_PUBLIC). */
export function isDemoLoginUiEnabled(): boolean {
  if (!envFlagOn(process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED)) return false;
  return true;
}

export function assertDemoPersonaAllowed(personaId: string): void {
  if (!isDemoLoginEnabled()) {
    throw new Error("Demo login disabled");
  }
  const persona = getDemoPersonaById(personaId);
  if (!persona) {
    throw new Error("Unknown demo persona");
  }
}

export function assertDemoCustomerCodeAllowed(code: string): void {
  if (!isDemoCustomerCode(code)) {
    throw new Error("Not a demo customer code");
  }
  const n = parseInt(code, 10);
  if (n < DEMO_CUSTOMER_CODE_MIN || n > DEMO_CUSTOMER_CODE_MAX) {
    throw new Error("Demo customer code out of range");
  }
}

export function assertDemoStaffEmailAllowed(email: string): void {
  if (!isDemoStaffEmail(email)) {
    throw new Error("Not a demo staff email");
  }
}
