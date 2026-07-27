"use client";

import { useEffect, useRef, useState } from "react";
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
  source: "inbox" | "push" | "test";
};

type InboxItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
};

const POLL_MS = 8_000;
const SEEN_KEY = "rocha-admin-inbox-seen";

function loadSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    const trimmed = [...ids].slice(-200);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota
  }
}

/**
 * Safe path: poll AdminInbox while any `/admin` tab is open.
 * Optional: SW BroadcastChannel when Web Push arrives in this browser.
 * Never depends on macOS/Windows OS toast visibility.
 */
export function AdminPushSwRegister() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const sinceRef = useRef<string>(new Date().toISOString());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    seenRef.current = loadSeenIds();
    sinceRef.current = new Date().toISOString();

    function show(next: Banner) {
      console.log("[push] in-app banner", next);
      setBanner(next);
    }

    // Best-effort SW (optional Web Push enhancement).
    if ("serviceWorker" in navigator) {
      void ensureFreshServiceWorker().catch((err) => {
        console.warn("[push] service worker register failed", err);
      });
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
      show({ title, body, url, tone: "info", source: "push" });
    }

    const onSwMessage = (event: MessageEvent) => {
      onPushMessage(event.data);
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(PUSH_BROADCAST_CHANNEL);
      channel.onmessage = (event) => onPushMessage(event.data);
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
        source: "test",
      });
    }
    window.addEventListener(ADMIN_INAPP_TOAST_EVENT, onCustomToast);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pollOnce() {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/admin/push/inbox?since=${encodeURIComponent(sinceRef.current)}`,
          { credentials: "same-origin" },
        );
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as {
          items?: InboxItem[];
          serverNow?: string;
        } | null;
        if (!data?.items?.length) {
          if (typeof data?.serverNow === "string") {
            // Keep cursor moving even with empty polls (clock skew safety).
          }
          return;
        }

        const fresh = data.items.filter((item) => !seenRef.current.has(item.id));
        for (const item of data.items) {
          seenRef.current.add(item.id);
          if (item.createdAt > sinceRef.current) {
            sinceRef.current = item.createdAt;
          }
        }
        saveSeenIds(seenRef.current);

        if (fresh.length > 0) {
          const latest = fresh[fresh.length - 1]!;
          show({
            title: latest.title,
            body: latest.body,
            url: latest.url || "/admin/cotizaciones",
            tone: "info",
            source: "inbox",
          });
        }
      } catch (err) {
        console.warn("[push] inbox poll failed", err);
      }
    }

    function schedule() {
      if (cancelled) return;
      timer = setTimeout(() => {
        void pollOnce().finally(() => schedule());
      }, POLL_MS);
    }

    void pollOnce().finally(() => schedule());

    const onVisible = () => {
      if (document.visibilityState === "visible") void pollOnce();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
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

  const sourceLabel =
    banner.source === "inbox"
      ? "Camino seguro (avisos en la app)"
      : banner.source === "push"
        ? "Web Push (mismo navegador)"
        : "Prueba in-app";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-0 top-0 z-[100] border-b-4 px-4 py-4 shadow-xl sm:px-6 ${toneClass}`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide opacity-90">
            {sourceLabel} — no depende del toast del sistema
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
            Con el admin abierto, este banner aparece aunque Windows/macOS
            bloquee las notificaciones del navegador.
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
