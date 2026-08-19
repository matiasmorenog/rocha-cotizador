/** Shared client helpers for admin Web Push SW registration. */

export const PUSH_BROADCAST_CHANNEL = "rocha-admin-push";

/** CustomEvent name — page can force global in-app toast without OS toast. */
export const ADMIN_INAPP_TOAST_EVENT = "rocha-admin-inapp-toast";

export type AdminInAppToastDetail = {
  title: string;
  body: string;
  url?: string;
  tone?: "info" | "success" | "error";
  /** When set, toast id = inbox-{id} and poll skips this row. */
  inboxId?: string;
};

/** Show an admin corner toast even if macOS/Chrome hides OS notifications. */
export function dispatchAdminInAppToast(detail: AdminInAppToastDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ADMIN_INAPP_TOAST_EVENT, { detail }),
  );
}

function scriptUrl(reg: ServiceWorkerRegistration): string {
  return (
    reg.active?.scriptURL ||
    reg.waiting?.scriptURL ||
    reg.installing?.scriptURL ||
    ""
  );
}

/**
 * Register `/sw.js` if missing. Always `update()` so a same-tab refresh
 * picks up a new worker (sessionStorage used to skip this after first load).
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
    await navigator.serviceWorker.ready;
    await existing.update().catch(() => undefined);
    await navigator.serviceWorker.ready;
    return existing;
  }

  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
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
  return reg;
}
