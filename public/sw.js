/* Rocha Cotizador — admin Web Push service worker */

const PUSH_CHANNEL = "rocha-admin-push";

self.addEventListener("install", (event) => {
  console.log("[push-sw] install");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  console.log("[push-sw] activate");
  event.waitUntil(self.clients.claim());
});

function parsePushData(event) {
  const defaults = {
    title: "Rocha Cotizador",
    body: "",
    url: "/admin/cotizaciones",
  };
  if (!event.data) {
    console.warn("[push-sw] push event with no data");
    return defaults;
  }
  try {
    const text = event.data.text();
    console.log("[push-sw] raw payload text:", text);
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return { ...defaults, ...parsed };
    }
  } catch (err) {
    console.warn("[push-sw] JSON.parse failed, fallback text", err);
    try {
      return { ...defaults, body: event.data.text() };
    } catch {
      // keep defaults
    }
  }
  return defaults;
}

async function broadcastToClients(payload) {
  const message = { type: "ROCHA_PUSH", ...payload };
  try {
    const channel = new BroadcastChannel(PUSH_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch (err) {
    console.warn("[push-sw] BroadcastChannel failed", err);
  }
  try {
    const clientsList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    console.log("[push-sw] open clients:", clientsList.length);
    for (const client of clientsList) {
      client.postMessage(message);
    }
  } catch (err) {
    console.warn("[push-sw] clients.postMessage failed", err);
  }
}

self.addEventListener("push", (event) => {
  console.log("[push-sw] push event received");
  const data = parsePushData(event);
  console.log("[push-sw] showing notification", data);

  event.waitUntil(
    (async () => {
      // Always show OS notification (required for userVisibleOnly + focused-tab Chrome quirks).
      await self.registration.showNotification(
        data.title || "Rocha Cotizador",
        {
          body: data.body || "",
          data: { url: data.url || "/admin/cotizaciones" },
          tag: data.tag || `rocha-push-${Date.now()}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
        },
      );
      await broadcastToClients(data);
      console.log("[push-sw] showNotification + broadcast done");
    })().catch((err) => {
      console.error("[push-sw] showNotification failed", err);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[push-sw] notificationclick", event.notification?.data);
  event.notification.close();
  const url = event.notification.data?.url || "/admin/cotizaciones";
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(target);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
