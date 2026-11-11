/**
 * Dev-only: refresh demo charts/data relative to "today" (Argentina).
 * Wipes + re-seeds stock sample (multi-day) and quotes/remitos.
 *
 * Safety: assertSafeDestructiveDb() — Neon main blocked; SEED_TARGET=development.
 *
 *   npm run dev:refresh-demo
 *
 * Optional env (passed through):
 *   STOCK_DAYS_BACK (default 21) — stock seed DAYS_BACK (3..60)
 *   ENTRIES_PER_CUSTOMER, CUSTOMERS_PER_MODULE, LINES_PER_ENTRY — stock
 *   QUOTE_COUNT (default 200) — quotes
 *   QUOTE_DAYS_BACK — quotes DAYS_BACK (default: days since Jan 1 AR, min 35, max 365)
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeDestructiveDb } from "../prisma/assert-safe-db";
import { toArgentinaDatetimeLocal } from "../src/lib/argentina-time";

assertSafeDestructiveDb();

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");

function envInt(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer ${min}..${max}, got ${raw}`);
  }
  return n;
}

function daysSinceYearStartAr(): number {
  const today = toArgentinaDatetimeLocal(new Date()).slice(0, 10);
  const year = today.slice(0, 4);
  const start = new Date(`${year}-01-01T12:00:00.000Z`);
  const end = new Date(`${today}T12:00:00.000Z`);
  const diff = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

function runScript(
  scriptRel: string,
  env: Record<string, string>,
  label: string,
): void {
  console.log(`\n=== ${label} ===`);
  const scriptPath = path.join(repoRoot, "scripts", scriptRel);
  const result = spawnSync(tsxBin, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SEED_TARGET: "development",
      ...env,
    },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const stockDaysBack = envInt("STOCK_DAYS_BACK", 21, 3, 60);
const quoteDaysBack = envInt(
  "QUOTE_DAYS_BACK",
  Math.min(365, Math.max(35, daysSinceYearStartAr())),
  1,
  365,
);
const quoteCount = envInt("QUOTE_COUNT", 200, 1, 500);

console.log(
  `Refresh demo (dev): stock DAYS_BACK=${stockDaysBack}, quotes DAYS_BACK=${quoteDaysBack} QUOTE_COUNT=${quoteCount}`,
);

runScript(
  "seed-stock-sample.ts",
  {
    DAYS_BACK: String(stockDaysBack),
    ...(process.env.ENTRIES_PER_CUSTOMER
      ? { ENTRIES_PER_CUSTOMER: process.env.ENTRIES_PER_CUSTOMER }
      : { ENTRIES_PER_CUSTOMER: "12" }),
  },
  "Stock sample (multi-day)",
);

runScript(
  "dev-seed-quotes.ts",
  {
    DAYS_BACK: String(quoteDaysBack),
    QUOTE_COUNT: String(quoteCount),
  },
  "Quotes / pedidos (dashboard)",
);

console.log("\nDemo refresh done.");
