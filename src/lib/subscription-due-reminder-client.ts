import type { SubscriptionDueReminderDto } from "@/lib/subscription-payments";
import {
  ensureFreshServiceWorker,
  getExistingPushSubscription,
} from "@/lib/push-sw-client";
import { pushNotificationBrandAssets } from "@/lib/push-notification-brand";

const DISMISS_PREFIX = "rocha-sub-due-dismiss:";
const OS_SHOWN_PREFIX = "rocha-sub-due-os:";

export function subscriptionDueToastId(
  periodYear: number,
  periodMonth: number,
): string {
  return `subscription-due-${periodYear}-${periodMonth}`;
}

function dismissKey(userId: string, todayAr: string): string {
  return `${DISMISS_PREFIX}${userId}:${todayAr}`;
}

function osShownKey(userId: string, todayAr: string): string {
  return `${OS_SHOWN_PREFIX}${userId}:${todayAr}`;
}

export function wasSubscriptionDueDismissedToday(
  userId: string,
  todayAr: string,
): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(dismissKey(userId, todayAr)) === "1";
  } catch {
    return false;
  }
}

export function markSubscriptionDueDismissedToday(
  userId: string,
  todayAr: string,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dismissKey(userId, todayAr), "1");
  } catch {
    // ignore quota
  }
}

function wasSubscriptionDueOsShownToday(
  userId: string,
  todayAr: string,
): boolean {
  try {
    return localStorage.getItem(osShownKey(userId, todayAr)) === "1";
  } catch {
    return false;
  }
}

function markSubscriptionDueOsShownToday(
  userId: string,
  todayAr: string,
): void {
  try {
    localStorage.setItem(osShownKey(userId, todayAr), "1");
  } catch {
    // ignore quota
  }
}

export function subscriptionDueCopy(opts: {
  periodLabel: string;
  canRegisterPayments: boolean;
}): { title: string; body: string; url: string } {
  const title = `Abono pendiente · ${opts.periodLabel}`;
  if (opts.canRegisterPayments) {
    return {
      title,
      body: "El período actual aún no figura como pagado. Registralo en Plataforma.",
      url: "/admin/plataforma",
    };
  }
  return {
    title,
    body: "El período actual aún no figura como pagado.",
    url: "/admin/configuracion?tab=servicio",
  };
}

/** OS toast once per AR day when Web Push is already granted + subscribed. */
export async function maybeShowSubscriptionDueOsNotification(opts: {
  userId: string;
  todayAr: string;
  title: string;
  body: string;
  url: string;
  periodYear: number;
  periodMonth: number;
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  if (wasSubscriptionDueOsShownToday(opts.userId, opts.todayAr)) return;

  const sub = await getExistingPushSubscription();
  if (!sub) return;

  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await ensureFreshServiceWorker());

  const { icon, badge } = pushNotificationBrandAssets(window.location.origin);
  await reg.showNotification(opts.title, {
    body: opts.body,
    tag: `rocha-sub-due-${opts.periodYear}-${opts.periodMonth}-${opts.todayAr}`,
    renotify: false,
    icon,
    badge,
    data: { url: opts.url },
  } as NotificationOptions);

  markSubscriptionDueOsShownToday(opts.userId, opts.todayAr);
}

export type SubscriptionDueApi = SubscriptionDueReminderDto;
