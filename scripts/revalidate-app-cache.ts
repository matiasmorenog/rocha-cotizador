/**
 * POST /api/revalidate after out-of-process DB mutations (seed, wipe, backfill).
 * Next.js `next/cache` cannot run in Prisma/tsx scripts — HTTP only.
 *
 * Never throws: a successful seed must not abort when the app is down.
 * Failures log a loud warning so Data Cache staleness is visible.
 *
 * Env (existing names only):
 *   REVALIDATE_SECRET — Bearer token (required to POST)
 *   APP_URL or AUTH_URL — origin, e.g. http://localhost:3000
 *   VERCEL_URL — fallback host (https:// prepended if missing)
 *   else → http://localhost:3000
 *
 * CLI: npx tsx scripts/revalidate-app-cache.ts
 * Does not load dotenv when imported (prod scripts pass AUTH_URL on the CLI).
 */
import { createRequire } from "node:module";

function resolveRevalidateBaseUrl(): string {
  const fromEnv = (
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) {
    return vercel.startsWith("http://") || vercel.startsWith("https://")
      ? vercel
      : `https://${vercel}`;
  }

  return "http://localhost:3000";
}

export async function revalidateAppCache(): Promise<boolean> {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const base = resolveRevalidateBaseUrl();
  const url = `${base}/api/revalidate`;
  const usingDefaultLocal =
    !process.env.APP_URL?.trim() &&
    !process.env.AUTH_URL?.trim() &&
    !process.env.VERCEL_URL?.trim();

  if (!secret) {
    console.warn(
      "[revalidate] WARN: skipped POST /api/revalidate — REVALIDATE_SECRET not set. Data Cache may be STALE. Set REVALIDATE_SECRET and AUTH_URL (or APP_URL).",
    );
    return false;
  }

  if (usingDefaultLocal) {
    console.warn(
      `[revalidate] WARN: APP_URL / AUTH_URL / VERCEL_URL unset — POSTing ${url}. Set AUTH_URL for preview/prod.`,
    );
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });
    const body = await res.text();
    if (!res.ok) {
      console.warn(
        `[revalidate] WARN: POST ${url} HTTP ${res.status}. Data Cache may be STALE.\n${body}`,
      );
      return false;
    }
    console.log(`[revalidate] ok: Data Cache revalidated via ${url}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[revalidate] WARN: POST ${url} failed (${msg}). Data Cache may be STALE — is the app running at ${base}?`,
    );
    return false;
  }
}

const invoked = process.argv[1]?.replace(/\\/g, "/") ?? "";
if (
  invoked.endsWith("/revalidate-app-cache.ts") ||
  invoked.endsWith("/revalidate-app-cache.js")
) {
  try {
    createRequire(import.meta.url)("dotenv/config");
  } catch {
    // optional — CI may not have dotenv installed
  }
  void revalidateAppCache();
}
