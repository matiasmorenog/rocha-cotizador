import webpush from "web-push";
import { db } from "@/lib/db";
import { pushNotificationBrandAssets } from "@/lib/push-notification-brand";

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
  icon?: string;
  badge?: string;
};

function pushSiteOrigin(): string {
  return process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
}

function withBrandAssets(
  payload: Omit<PushPayload, "icon" | "badge">,
): PushPayload {
  const { icon, badge } = pushNotificationBrandAssets(pushSiteOrigin());
  return { ...payload, icon, badge };
}

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

  // JSON string body — web-push encrypts and sets Content-Encoding: aes128gcm.
  const body = JSON.stringify(withBrandAssets(payload));
  console.info(
    "[push] notifying",
    subscriptions.length,
    "subscription(s) for",
    logLabel,
    "payloadBytes",
    Buffer.byteLength(body, "utf8"),
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
          {
            TTL: 60 * 60,
            urgency: "high",
            // Explicit so FCM/Chrome always get encrypted payload headers.
            contentEncoding: "aes128gcm",
          },
        );
        console.info(
          "[push] send ok",
          host,
          "status",
          res.statusCode,
          "encoding",
          "aes128gcm",
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

export type AdminInboxItemDto = {
  id: string;
  title: string;
  body: string;
  url: string;
  quoteId: string | null;
  kind: string;
  createdAt: string;
};

/** Persist in-app notification for admin inbox polling. */
export async function enqueueAdminInbox(input: {
  title: string;
  body: string;
  url: string;
  quoteId?: string | null;
  kind?: "quote" | "test";
}): Promise<AdminInboxItemDto> {
  const row = await db.adminInboxItem.create({
    data: {
      title: input.title,
      body: input.body,
      url: input.url,
      quoteId: input.quoteId ?? null,
      kind: input.kind ?? "quote",
    },
  });
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    quoteId: row.quoteId,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAdminInboxSince(
  since: Date,
  limit = 20,
): Promise<AdminInboxItemDto[]> {
  const rows = await db.adminInboxItem.findMany({
    where: { createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    quoteId: row.quoteId,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Always enqueue in-app inbox; Web Push is best-effort optional enhancement.
 * Never throws — callers may await safely from quote create.
 */
export async function notifyAdminsNewQuote(
  quote: NewQuotePushPayload,
): Promise<void> {
  const title = `Nueva cotización #${quote.number}`;
  const body = quote.customerName;
  const url = `/remitos/${quote.id}`;

  try {
    await enqueueAdminInbox({
      title,
      body,
      url,
      quoteId: quote.id,
      kind: "quote",
    });
  } catch (err) {
    console.error("[push] enqueueAdminInbox failed", err);
  }

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { user: { role: "ADMIN" } },
    });
    await sendToSubscriptions(
      subscriptions,
      {
        title,
        body,
        url,
        tag: `rocha-quote-${quote.id}-${Date.now()}`,
      },
      `quote ${quote.number}`,
    );
  } catch (err) {
    console.error("[push] notifyAdminsNewQuote web-push failed", err);
  }
}

/** Probar — creates inbox row for in-app toast. */
export async function enqueueAdminInboxTest(): Promise<AdminInboxItemDto> {
  return enqueueAdminInbox({
    title: "Notificación de prueba",
    body: "Así se ven las notificaciones en el admin.",
    url: "/admin/configuracion",
    kind: "test",
  });
}

/**
 * Send a test push to one admin's stored subscriptions (or a single endpoint).
 * Optional enhancement when OS notifications are allowed.
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
      title: "Notificación de prueba",
      body: "Notificación del sistema de Rocha Cotizador.",
      url: "/admin/configuracion",
      tag: `rocha-test-${Date.now()}`,
    },
    "test-push",
  );
}
