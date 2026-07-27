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

/**
 * Notify all ADMIN users with a stored PushSubscription.
 * Never throws — callers may await safely from quote create.
 */
export async function notifyAdminsNewQuote(
  quote: NewQuotePushPayload,
): Promise<void> {
  try {
    if (!configureWebPush()) {
      console.warn(
        "[push] VAPID env missing; skip admin notify for quote",
        quote.number,
      );
      return;
    }

    const subscriptions = await db.pushSubscription.findMany({
      where: { user: { role: "ADMIN" } },
    });
    if (subscriptions.length === 0) {
      console.warn(
        "[push] no admin PushSubscription rows; skip notify for quote",
        quote.number,
      );
      return;
    }

    const payload = JSON.stringify({
      title: `Nueva cotización #${quote.number}`,
      body: quote.customerName,
      url: `/remitos/${quote.id}`,
    });

    console.info(
      "[push] notifying",
      subscriptions.length,
      "admin subscription(s) for quote",
      quote.number,
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
            payload,
            { TTL: 60 * 60, urgency: "high" },
          );
          console.info(
            "[push] send ok",
            host,
            "status",
            res.statusCode,
            "quote",
            quote.number,
          );
          return true;
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
            return false;
          }
          console.error("[push] send failed", host, err);
          return false;
        }
      }),
    );

    console.info(
      "[push] done quote",
      quote.number,
      "ok",
      results.filter(Boolean).length,
      "/",
      results.length,
    );
  } catch (err) {
    console.error("[push] notifyAdminsNewQuote failed", err);
  }
}
