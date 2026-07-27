"use client";

import { useEffect, useState } from "react";
import {
  ensureFreshServiceWorker,
  PUSH_BROADCAST_CHANNEL,
} from "@/lib/push-sw-client";

type InAppPush = { title: string; body: string; url: string };

/**
 * Keep the admin Web Push service worker registered whenever an admin
 * session loads. Also listens for SW/BroadcastChannel push while any
 * `/admin` tab is open (in-app banner; OS toast still via showNotification).
 */
export function AdminPushSwRegister() {
  const [banner, setBanner] = useState<InAppPush | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void ensureFreshServiceWorker().catch((err) => {
      console.warn("[push] service worker register failed", err);
    });

    function onPushMessage(raw: unknown) {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as Record<string, unknown>;
      if (msg.type !== "ROCHA_PUSH") return;
      const title =
        typeof msg.title === "string" ? msg.title : "Rocha Cotizador";
      const body = typeof msg.body === "string" ? msg.body : "";
      const url =
        typeof msg.url === "string" ? msg.url : "/admin/cotizaciones";
      console.log("[push] admin tab received", { title, body, url });
      setBanner({ title, body, url });
    }

    const onSwMessage = (event: MessageEvent) => {
      onPushMessage(event.data);
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(PUSH_BROADCAST_CHANNEL);
      channel.onmessage = (event) => onPushMessage(event.data);
    } catch {
      // unsupported
    }

    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
      channel?.close();
    };
  }, []);

  if (!banner) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg"
    >
      <p className="text-sm font-semibold text-neutral-900">{banner.title}</p>
      <p className="mt-1 text-sm text-neutral-600">{banner.body}</p>
      <div className="mt-3 flex gap-2">
        <a
          href={banner.url}
          className="text-sm font-medium text-neutral-900 underline"
        >
          Abrir
        </a>
        <button
          type="button"
          className="text-sm text-neutral-500"
          onClick={() => setBanner(null)}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
