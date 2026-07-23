/**
 * Guard for seed / one-off mutation scripts.
 * Blocks Neon production (branch `main`) and requires an explicit allow flag.
 *
 * Neon hosts (rocha-cotizador, us-west-2):
 *   main / production: ep-cool-mud-a6k5vosf
 *   development:       ep-noisy-darkness-a6ms81wq
 *
 * Override markers via NEON_PROD_HOST / NEON_DEV_HOST (comma-separated substrings).
 */

/** Neon `main` endpoint id — always refuse (direct + pooler). */
const HARDCODED_PROD_HOST_MARKERS = ["ep-cool-mud-a6k5vosf"];

/** Neon `development` endpoint id — required when SEED_TARGET=development. */
const HARDCODED_DEV_HOST_MARKERS = ["ep-noisy-darkness-a6ms81wq"];

function splitMarkers(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameFromDatabaseUrl(databaseUrl: string): string {
  try {
    const withProtocol = databaseUrl.replace(
      /^postgresql:/i,
      "http:",
    );
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    throw new Error(
      "Refusing destructive DB op: DATABASE_URL is not a valid URL.",
    );
  }
}

function markersMatch(host: string, markers: string[]): boolean {
  return markers.some((m) => host.includes(m));
}

/**
 * Call before any seed / bulk password reset / one-off DB mutation.
 * Never runs against Neon production/`main`.
 */
export function assertSafeDestructiveDb(
  databaseUrl = process.env.DATABASE_URL,
): void {
  if (!databaseUrl?.trim()) {
    throw new Error(
      "Refusing destructive DB op: DATABASE_URL is missing.",
    );
  }

  const host = hostnameFromDatabaseUrl(databaseUrl);
  const prodMarkers = [
    ...HARDCODED_PROD_HOST_MARKERS,
    ...splitMarkers(process.env.NEON_PROD_HOST),
    ...splitMarkers(process.env.PRODUCTION_DATABASE_HOST),
  ];

  if (markersMatch(host, prodMarkers)) {
    throw new Error(
      "Refusing to seed production/main. DATABASE_URL points at Neon production (branch main). Use the development branch URL (see .env.example / DEPLOY.md).",
    );
  }

  // Neon connection strings sometimes carry options=branch%3Dmain
  const urlLower = databaseUrl.toLowerCase();
  if (
    urlLower.includes("branch=main") ||
    urlLower.includes("branch%3dmain")
  ) {
    throw new Error(
      "Refusing to seed production/main. DATABASE_URL includes branch=main.",
    );
  }

  const allowFlag = process.env.ALLOW_DESTRUCTIVE_DB === "1";
  const seedTarget = (process.env.SEED_TARGET ?? "").trim().toLowerCase();
  const targetDevelopment = seedTarget === "development";

  if (!allowFlag && !targetDevelopment) {
    throw new Error(
      "Refusing destructive DB op: set SEED_TARGET=development (Neon development branch) or ALLOW_DESTRUCTIVE_DB=1 (non-prod only, e.g. local Postgres).",
    );
  }

  if (targetDevelopment) {
    const devMarkers = [
      ...HARDCODED_DEV_HOST_MARKERS,
      ...splitMarkers(process.env.NEON_DEV_HOST),
    ];
    const isNeon = host.includes("neon.tech");
    if (isNeon && !markersMatch(host, devMarkers)) {
      throw new Error(
        "Refusing destructive DB op: SEED_TARGET=development but DATABASE_URL host is not the Neon development endpoint. Expected host containing ep-noisy-darkness-a6ms81wq (or NEON_DEV_HOST).",
      );
    }
  }

  console.log(
    `[db-guard] OK — host=${host} (SEED_TARGET=${seedTarget || "n/a"}, ALLOW_DESTRUCTIVE_DB=${allowFlag ? "1" : "0"})`,
  );
}
