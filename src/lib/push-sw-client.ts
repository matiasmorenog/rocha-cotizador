/** Shared client helpers for admin Web Push SW registration. */

export const PUSH_BROADCAST_CHANNEL = "rocha-admin-push";

function scriptUrl(reg: ServiceWorkerRegistration): string {
  return (
    reg.active?.scriptURL ||
    reg.waiting?.scriptURL ||
    reg.installing?.scriptURL ||
    ""
  );
}

/**
 * Register `/sw.js` (or update if already controlling).
 * Unregisters *other* SW scripts only — never drops an existing `/sw.js`
 * registration (that would wipe the PushSubscription).
 */
export async function ensureFreshServiceWorker(): Promise<ServiceWorkerRegistration> {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.map(async (reg) => {
      const url = scriptUrl(reg);
      if (url && !url.endsWith("/sw.js")) {
        try {
          await reg.unregister();
        } catch {
          // continue
        }
      }
    }),
  );

  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing && scriptUrl(existing).endsWith("/sw.js")) {
    await existing.update().catch(() => undefined);
    await navigator.serviceWorker.ready;
    return existing;
  }

  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
  await reg.update().catch(() => undefined);
  return reg;
}

/**
 * Hard reset: unregister every SW, then register `/sw.js`.
 * Caller MUST re-subscribe afterwards (unregister clears PushSubscription).
 */
export async function resetServiceWorker(): Promise<ServiceWorkerRegistration> {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.map(async (reg) => {
      try {
        await reg.unregister();
      } catch {
        // continue
      }
    }),
  );

  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
  await reg.update().catch(() => undefined);
  return reg;
}
