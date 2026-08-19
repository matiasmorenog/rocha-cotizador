/* Rocha Cotizador — admin Web Push service worker */
/* v12 — never cache HTML navigations (same-tab reload must hit the network) */

const PUSH_CHANNEL = "rocha-admin-push";
const FALLBACK_TITLE = "Nueva cotización";
const FALLBACK_URL = "/admin/cotizaciones";
const ICON_PATH = "/brand/rocha-mark.png";

function brandIconUrl() {
  return new URL(ICON_PATH, self.location.origin).href;
}

function resolveBrandAssetUrl(value) {
  if (typeof value === "string" && value.trim()) {
    try {
      return new URL(value, self.location.origin).href;
    } catch {
      return brandIconUrl();
    }
  }
  return brandIconUrl();
}

self.addEventListener("install", (event) => {
  console.log("[push-sw] install");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  console.log("[push-sw] activate");
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (err) {
        console.warn("[push-sw] cache cleanup failed", err);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() =>
      fetch(event.request),
    ),
  );
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
        icon: typeof parsed.icon === "string" ? parsed.icon : undefined,
        badge: typeof parsed.badge === "string" ? parsed.badge : undefined,
        id: typeof parsed.id === "string" ? parsed.id : undefined,
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
        icon: typeof parsed.icon === "string" ? parsed.icon : undefined,
        badge: typeof parsed.badge === "string" ? parsed.badge : undefined,
        id: typeof parsed.id === "string" ? parsed.id : undefined,
      };
    }
  } catch (err) {
    console.warn("[push-sw] JSON.parse failed — fallback title + raw body", err);
    return { ...defaults, body: text.slice(0, 180) };
  }

  return defaults;
}

async function getOpenClients() {
  try {
    return await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
  } catch (err) {
    console.warn("[push-sw] clients.matchAll failed", err);
    return [];
  }
}

async function broadcastToClients(payload, clientsList) {
  const message = { type: "ROCHA_PUSH", ...payload };
  try {
    const channel = new BroadcastChannel(PUSH_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch (err) {
    console.warn("[push-sw] BroadcastChannel failed", err);
  }
  try {
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
  const icon = resolveBrandAssetUrl(data.icon);
  const badge = resolveBrandAssetUrl(data.badge ?? data.icon);
  const clientsList = await getOpenClients();
  const isTestTag = typeof data.tag === "string" && data.tag.startsWith("rocha-test");
  // Any open admin tab plays its own in-app chime for non-test pushes (see
  // admin-push-sw-register.tsx). Silence the OS sound in that case so the
  // admin never hears both at once — "Probar sistema" stays untouched since
  // its tag is skipped client-side and needs the OS sound to prove it works.
  const suppressOsSound = clientsList.length > 0 && !isTestTag;
  const options = {
    body: data.body || "",
    data: { url: data.url || FALLBACK_URL },
    tag: data.tag || `rocha-push-${Date.now()}`,
    icon,
    badge,
    renotify: true,
    // false = more reliable banners on macOS/Windows when tab focused
    requireInteraction: false,
    silent: suppressOsSound,
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
        icon: brandIconUrl(),
        badge: brandIconUrl(),
        tag: `rocha-push-fallback-${Date.now()}`,
        silent: false,
      });
    } catch (err2) {
      console.error("[push-sw] fallback showNotification also failed", err2);
    }
  }

  try {
    await broadcastToClients(
      {
        title,
        body: options.body,
        url: options.data.url,
        tag: options.tag,
        id: data.id,
      },
      clientsList,
    );
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
