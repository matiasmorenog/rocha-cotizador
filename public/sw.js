/* Rocha Cotizador — admin Web Push service worker */
/* v7 — louder-friendly OS options + stable showNotification */

const PUSH_CHANNEL = "rocha-admin-push";
const FALLBACK_TITLE = "Nueva cotización";
const FALLBACK_URL = "/admin/cotizaciones";
const ICON = "/brand/rocha-logo.png";

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
    title: FALLBACK_TITLE,
    body: "",
    url: FALLBACK_URL,
  };
  if (!event.data) {
    console.warn("[push-sw] push event with no data — using fallback");
    return defaults;
  }

  // Prefer json(); fall back to text() once if needed.
  try {
    const parsed = event.data.json();
    if (parsed && typeof parsed === "object") {
      return {
        title:
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title
            : FALLBACK_TITLE,
        body: typeof parsed.body === "string" ? parsed.body : "",
        url:
          typeof parsed.url === "string" && parsed.url.trim()
            ? parsed.url
            : FALLBACK_URL,
        tag: typeof parsed.tag === "string" ? parsed.tag : undefined,
      };
    }
  } catch {
    // continue to text
  }

  let text = "";
  try {
    text = event.data.text();
  } catch (err) {
    console.warn("[push-sw] event.data.text() failed", err);
    return defaults;
  }

  console.log("[push-sw] raw payload text:", text);
  if (!text || !text.trim()) return defaults;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return {
        title:
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title
            : FALLBACK_TITLE,
        body: typeof parsed.body === "string" ? parsed.body : "",
        url:
          typeof parsed.url === "string" && parsed.url.trim()
            ? parsed.url
            : FALLBACK_URL,
        tag: typeof parsed.tag === "string" ? parsed.tag : undefined,
      };
    }
  } catch (err) {
    console.warn("[push-sw] JSON.parse failed — fallback title + raw body", err);
    return { ...defaults, body: text.slice(0, 180) };
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

/**
 * Always show an OS notification — even if payload parse fails.
 * Must stay inside event.waitUntil so Chrome does not kill the SW early.
 */
async function handlePush(event) {
  console.log("[push-sw] push event received");
  let data;
  try {
    data = parsePushData(event);
  } catch (err) {
    console.error("[push-sw] parsePushData threw — hard fallback", err);
    data = {
      title: FALLBACK_TITLE,
      body: "",
      url: FALLBACK_URL,
    };
  }

  const title = data.title || FALLBACK_TITLE;
  const options = {
    body: data.body || "",
    data: { url: data.url || FALLBACK_URL },
    tag: data.tag || `rocha-push-${Date.now()}`,
    icon: ICON,
    badge: ICON,
    renotify: true,
    // false = more reliable banners on macOS/Windows when tab focused
    requireInteraction: false,
    silent: false,
  };

  console.log("[push-sw] showing notification", { title, ...options });

  // OS toast FIRST — never skip for open clients.
  try {
    await self.registration.showNotification(title, options);
    console.log("[push-sw] showNotification done");
  } catch (err) {
    console.error("[push-sw] showNotification failed", err);
    try {
      await self.registration.showNotification(FALLBACK_TITLE, {
        body: "Abrí el admin para ver la cotización.",
        data: { url: FALLBACK_URL },
        icon: ICON,
        tag: `rocha-push-fallback-${Date.now()}`,
        silent: false,
      });
    } catch (err2) {
      console.error("[push-sw] fallback showNotification also failed", err2);
    }
  }

  try {
    await broadcastToClients({
      title,
      body: options.body,
      url: options.data.url,
      tag: options.tag,
    });
  } catch (err) {
    console.warn("[push-sw] broadcast failed", err);
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  console.log("[push-sw] notificationclick", event.notification?.data);
  event.notification.close();
  const url = event.notification.data?.url || FALLBACK_URL;
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
