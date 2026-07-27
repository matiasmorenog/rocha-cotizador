import webpush from "web-push";
import { db } from "@/lib/db";

export type NewQuotePushPayload = {
  id: string;
  number: string;
  customerName: string;
};

/** Strip accidental surrounding quotes from .env values. */
function envTrim(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

function vapidPublicKey(): string | null {
  return envTrim(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

function vapidPrivateKey(): string | null {
  return envTrim(process.env.VAPID_PRIVATE_KEY);
}

function vapidSubject(): string | null {
  return envTrim(process.env.VAPID_SUBJECT);
}

function configureWebPush() {
  const subject = vapidSubject();
  const publicKey = vapidPublicKey();
  const privateKey = vapidPrivateKey();
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey();
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type StoredSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSendResult = {
  ok: number;
  total: number;
  staleRemoved: number;
};

async function sendToSubscriptions(
  subscriptions: StoredSub[],
  payload: PushPayload,
  logLabel: string,
): Promise<PushSendResult> {
  if (!configureWebPush()) {
    console.warn("[push] VAPID env missing; skip", logLabel);
    return { ok: 0, total: 0, staleRemoved: 0 };
  }
  if (subscriptions.length === 0) {
    console.warn("[push] no subscriptions; skip", logLabel);
    return { ok: 0, total: 0, staleRemoved: 0 };
  }

  const body = JSON.stringify(payload);
  console.info(
    "[push] notifying",
    subscriptions.length,
    "subscription(s) for",
    logLabel,
  );

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const host = (() => {
        try {
          return new URL(sub.endpoint).host;
        } catch {
          return "invalid-endpoint";
        }
      })();
      try {
        const res = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60, urgency: "high" },
        );
        console.info(
          "[push] send ok",
          host,
          "status",
          res.statusCode,
          logLabel,
        );
        return { ok: true as const, stale: false };
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode: unknown }).statusCode)
            : null;
        if (statusCode === 404 || statusCode === 410) {
          console.warn("[push] stale subscription removed", host, statusCode);
          await db.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => undefined);
          return { ok: false as const, stale: true };
        }
        console.error("[push] send failed", host, err);
        return { ok: false as const, stale: false };
      }
    }),
  );

  const ok = results.filter((r) => r.ok).length;
  const staleRemoved = results.filter((r) => r.stale).length;
  console.info("[push] done", logLabel, "ok", ok, "/", results.length);
  return { ok, total: results.length, staleRemoved };
}

/**
 * Notify all ADMIN users with a stored PushSubscription.
 * Never throws — callers may await safely from quote create.
 */
export async function notifyAdminsNewQuote(
  quote: NewQuotePushPayload,
): Promise<void> {
  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { user: { role: "ADMIN" } },
    });
    await sendToSubscriptions(
      subscriptions,
      {
        title: `Nueva cotización #${quote.number}`,
        body: quote.customerName,
        url: `/remitos/${quote.id}`,
        tag: `rocha-quote-${quote.id}`,
      },
      `quote ${quote.number}`,
    );
  } catch (err) {
    console.error("[push] notifyAdminsNewQuote failed", err);
  }
}

/**
 * Send a test push to one admin's stored subscriptions (or a single endpoint).
 */
export async function sendTestPushToAdmin(opts: {
  userId: string;
  endpoint?: string;
}): Promise<PushSendResult> {
  const subscriptions = await db.pushSubscription.findMany({
    where: {
      userId: opts.userId,
      ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
    },
  });
  return sendToSubscriptions(
    subscriptions,
    {
      title: "Prueba Rocha Cotizador",
      body: "Si ves esto, Web Push + service worker funcionan.",
      url: "/admin/configuracion",
      tag: `rocha-test-${Date.now()}`,
    },
    "test-push",
  );
}
