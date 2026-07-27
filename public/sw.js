/* Rocha Cotizador — admin Web Push service worker */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Rocha Cotizador", body: "", url: "/admin/cotizaciones" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        data = { ...data, ...parsed };
      }
    }
  } catch {
    try {
      if (event.data) {
        data.body = event.data.text();
      }
    } catch {
      // keep defaults
    }
  }

  event.waitUntil(
    self.registration
      .showNotification(data.title || "Rocha Cotizador", {
        body: data.body || "",
        data: { url: data.url || "/admin/cotizaciones" },
        tag: "rocha-new-quote",
        renotify: true,
        requireInteraction: true,
      })
      .catch((err) => {
        console.error("[push] showNotification failed", err);
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
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
