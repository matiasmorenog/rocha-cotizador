import { clearCachedCatalog } from "@/lib/client-catalog-cache";

const RELOAD_PARAM = "_r";

/**
 * Same-tab reload that actually gets a new document.
 * Cmd+Shift+R can restore bfcache / skip SW update; a new URL does not.
 */
export async function forceReloadApp(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    clearCachedCatalog();
  } catch {
    // ignore
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // ignore
  }

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.update().catch(() => undefined)));
    }
  } catch {
    // ignore
  }

  const url = new URL(window.location.href);
  url.searchParams.set(RELOAD_PARAM, String(Date.now()));
  window.location.replace(url.href);
}

/** Drop the cache-bust query so the address bar stays clean. */
export function stripReloadParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RELOAD_PARAM)) return;
  url.searchParams.delete(RELOAD_PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}
