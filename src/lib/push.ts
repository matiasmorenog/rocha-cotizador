import webpush from "web-push";
import { db } from "@/lib/db";

export type NewQuotePushPayload = {
  id: string;
  number: string;
  customerName: string;
};

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function configureWebPush() {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

/**
 * Notify all ADMIN users with a stored PushSubscription.
 * Never throws — safe to fire-and-forget from quote create.
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
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: `Nueva cotización #${quote.number}`,
      body: quote.customerName,
      url: `/remitos/${quote.id}`,
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          const statusCode =
            err && typeof err === "object" && "statusCode" in err
              ? Number((err as { statusCode: unknown }).statusCode)
              : null;
          if (statusCode === 404 || statusCode === 410) {
            await db.pushSubscription
              .delete({ where: { endpoint: sub.endpoint } })
              .catch(() => undefined);
            return;
          }
          console.error("[push] send failed", sub.endpoint, err);
        }
      }),
    );
  } catch (err) {
    console.error("[push] notifyAdminsNewQuote failed", err);
  }
}
