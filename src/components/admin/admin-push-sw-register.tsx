"use client";

import { useEffect, useState } from "react";
import {
  ensureFreshServiceWorker,
  PUSH_BROADCAST_CHANNEL,
  ADMIN_INAPP_TOAST_EVENT,
  type AdminInAppToastDetail,
} from "@/lib/push-sw-client";

type Banner = {
  title: string;
  body: string;
  url: string;
  tone: "info" | "success" | "error";
};

/**
 * Keep the admin Web Push service worker registered whenever an admin
 * session loads. Shows a large in-app banner on ANY `/admin` page when:
 * - SW push arrives (BroadcastChannel / postMessage)
 * - Probar / page code dispatches ADMIN_INAPP_TOAST_EVENT
 *
 * macOS Focus / Chrome "Use Focus filters" / Deliver Quietly often hide
 * OS toasts while page-origin Notification or this banner still work.
 */
export function AdminPushSwRegister() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void ensureFreshServiceWorker().catch((err) => {
      console.warn("[push] service worker register failed", err);
    });

    function show(next: Banner) {
      console.log("[push] in-app banner", next);
      setBanner(next);
    }

    function onPushMessage(raw: unknown) {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as Record<string, unknown>;
      if (msg.type !== "ROCHA_PUSH") return;
      const title =
        typeof msg.title === "string" ? msg.title : "Nueva cotización";
      const body = typeof msg.body === "string" ? msg.body : "";
      const url =
        typeof msg.url === "string" ? msg.url : "/admin/cotizaciones";
      show({ title, body, url, tone: "info" });
    }

    const onSwMessage = (event: MessageEvent) => {
      console.log("[push] navigator.serviceWorker message", event.data);
      onPushMessage(event.data);
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(PUSH_BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        console.log("[push] BroadcastChannel message", event.data);
        onPushMessage(event.data);
      };
    } catch {
      // unsupported
    }

    function onCustomToast(event: Event) {
      const detail = (event as CustomEvent<AdminInAppToastDetail>).detail;
      if (!detail?.title) return;
      show({
        title: detail.title,
        body: detail.body ?? "",
        url: detail.url ?? "/admin/configuracion",
        tone: detail.tone ?? "success",
      });
    }
    window.addEventListener(ADMIN_INAPP_TOAST_EVENT, onCustomToast);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
      channel?.close();
      window.removeEventListener(ADMIN_INAPP_TOAST_EVENT, onCustomToast);
    };
  }, []);

  if (!banner) return null;

  const toneClass =
    banner.tone === "error"
      ? "border-red-500 bg-red-600 text-white"
      : banner.tone === "success"
        ? "border-emerald-500 bg-emerald-600 text-white"
        : "border-amber-400 bg-amber-500 text-neutral-950";

  const mutedClass =
    banner.tone === "info" ? "text-neutral-900/80" : "text-white/90";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-0 top-0 z-[100] border-b-4 px-4 py-4 shadow-xl sm:px-6 ${toneClass}`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide opacity-90">
            Aviso in-app (no depende del toast del sistema)
          </p>
          <p className="mt-1 text-lg font-bold leading-tight sm:text-xl">
            {banner.title}
          </p>
          {banner.body ? (
            <p className={`mt-1 text-sm sm:text-base ${mutedClass}`}>
              {banner.body}
            </p>
          ) : null}
          <p className={`mt-2 text-xs ${mutedClass}`}>
            Si no ves el globo de macOS/Chrome: Focus, “Use Focus filters” o
            Deliver Quietly pueden ocultarlo. Este banner confirma que el push
            llegó a la pestaña.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={banner.url}
            className="rounded-md bg-white/95 px-3 py-2 text-sm font-semibold text-neutral-900"
          >
            Abrir
          </a>
          <button
            type="button"
            className="rounded-md bg-black/20 px-3 py-2 text-sm font-medium"
            onClick={() => setBanner(null)}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
