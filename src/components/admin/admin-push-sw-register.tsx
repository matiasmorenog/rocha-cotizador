"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ensureFreshServiceWorker,
  PUSH_BROADCAST_CHANNEL,
  ADMIN_INAPP_TOAST_EVENT,
  type AdminInAppToastDetail,
} from "@/lib/push-sw-client";
import {
  AdminNotificationToasts,
  type AdminToastItem,
} from "@/components/admin/admin-notification-toasts";
import {
  claimChimeOnce,
  playAdminNotificationSound,
  stopAdminNotificationSound,
  unlockAdminNotificationSound,
} from "@/lib/admin-notification-sound";
import { scheduleIdleWork } from "@/lib/schedule-idle";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
};

const POLL_MS = 8_000;
/** Defer inbox poll + SW register so first admin paint is not competing with RSC. */
const PUSH_BOOT_DEFER_MS = 2_500;
const TOAST_TTL_MS = 6_000;
const MAX_TOASTS = 4;
/** Only for Web Push double-delivery (BroadcastChannel + postMessage). */
const PUSH_DEDUPE_MS = 2_000;
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

function fingerprint(title: string, body: string, url?: string): string {
  return `${title}\0${body}\0${url ?? ""}`;
}

/**
 * Poll AdminInbox while any `/admin` tab is open.
 * In-app pref from session/JWT only — never hits DB for the preference.
 * Optional: SW BroadcastChannel when Web Push arrives in this browser.
 */
export function AdminPushSwRegister() {
  const { data: session } = useSession();
  const inAppEnabled = session?.user?.inAppNotificationsEnabled !== false;
  const enabledRef = useRef(inAppEnabled);

  const [toasts, setToasts] = useState<AdminToastItem[]>([]);
  const sinceRef = useRef<string>(new Date().toISOString());
  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  /** Recent fingerprints → timestamp; blocks double emit (Probar+poll, BC+postMessage). */
  const recentFpRef = useRef<Map<string, number>>(new Map());
  /** Toast ids that already played their chime — sound fires once per id, never on re-delivery or dismiss. */
  const playedSoundIdsRef = useRef<Set<string>>(new Set());

  // Keep poll/toast gates in sync with session without reading refs during render.
  useEffect(() => {
    enabledRef.current = inAppEnabled;
    if (inAppEnabled) return;
    for (const t of timersRef.current.values()) clearTimeout(t);
    timersRef.current.clear();
  }, [inAppEnabled]);

  // Drop toast state when pref turns off so they don't reappear on re-enable.
  if (!inAppEnabled && toasts.length > 0) {
    setToasts([]);
  }

  function dismiss(id: string) {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    // Every dismiss path (X, body click, TTL timeout above) lands here —
    // cut any still-ringing appear chime so closing a toast is never heard.
    stopAdminNotificationSound();
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function markInboxSeen(inboxId: string, createdAt?: string) {
    seenRef.current.add(inboxId);
    saveSeenIds(seenRef.current);
    if (createdAt && createdAt > sinceRef.current) {
      sinceRef.current = createdAt;
    }
  }

  function pushToast(next: Omit<AdminToastItem, "id"> & { id?: string }) {
    if (!enabledRef.current) return;

    const id =
      next.id ??
      `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Fingerprint dedupe only for OS push echo (same payload twice).
    // Probar / inbox each get a unique id — stacking must work.
    if (next.source === "push") {
      const fp = fingerprint(next.title, next.body, next.url);
      const now = Date.now();
      for (const [key, at] of recentFpRef.current) {
        if (now - at > PUSH_DEDUPE_MS) recentFpRef.current.delete(key);
      }
      const lastAt = recentFpRef.current.get(fp);
      if (lastAt !== undefined && now - lastAt < PUSH_DEDUPE_MS) {
        return;
      }
      recentFpRef.current.set(fp, now);
    }

    // One chime per toast id, ever — covers Probar+poll races and any
    // later re-delivery with the same id. Never plays again on dismiss/exit.
    // claimChimeOnce is the cross-tab half of this: playedSoundIdsRef alone
    // only dedupes *within* this tab — every other open /admin tab has its
    // own ref and its own sessionStorage, and independently discovers the
    // same id via its own poll a few seconds later, playing its own chime.
    if (!playedSoundIdsRef.current.has(id)) {
      playedSoundIdsRef.current.add(id);
      if (claimChimeOnce(id)) {
        playAdminNotificationSound();
      }
    }
    setToasts((prev) => {
      const withoutDup = prev.filter((t) => t.id !== id);
      return [...withoutDup, { ...next, id }].slice(-MAX_TOASTS);
    });
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    timersRef.current.set(
      id,
      setTimeout(() => dismiss(id), TOAST_TTL_MS),
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const toastTimers = timersRef.current;
    seenRef.current = loadSeenIds();
    sinceRef.current = new Date().toISOString();

    const unlock = () => {
      unlockAdminNotificationSound();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    function onPushMessage(raw: unknown) {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as Record<string, unknown>;
      if (msg.type !== "ROCHA_PUSH") return;
      const tag = typeof msg.tag === "string" ? msg.tag : "";
      if (tag.startsWith("rocha-test")) return;
      const title =
        typeof msg.title === "string" ? msg.title : "Nueva cotización";
      const body = typeof msg.body === "string" ? msg.body : "";
      const url =
        typeof msg.url === "string" ? msg.url : "/admin/cotizaciones";
      const inboxId = typeof msg.id === "string" ? msg.id : null;
      if (inboxId) {
        markInboxSeen(inboxId);
      }
      pushToast({
        id: inboxId ? `inbox-${inboxId}` : undefined,
        title,
        body,
        url,
        tone: "info",
        source: "push",
      });
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
      const inboxId =
        typeof detail.inboxId === "string" && detail.inboxId
          ? detail.inboxId
          : null;
      if (inboxId) {
        markInboxSeen(inboxId);
      }
      pushToast({
        id: inboxId ? `inbox-${inboxId}` : undefined,
        title: detail.title,
        body: detail.body ?? "",
        url: detail.url,
        tone: detail.tone ?? "success",
        source: "test",
      });
    }
    window.addEventListener(ADMIN_INAPP_TOAST_EVENT, onCustomToast);

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function pollOnce() {
      if (cancelled || document.visibilityState === "hidden") return;
      if (!enabledRef.current) return;
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
        if (!data?.items?.length) return;

        const fresh = data.items.filter(
          (item) => !seenRef.current.has(item.id),
        );
        for (const item of data.items) {
          seenRef.current.add(item.id);
          if (item.createdAt > sinceRef.current) {
            sinceRef.current = item.createdAt;
          }
        }
        saveSeenIds(seenRef.current);

        for (const item of fresh) {
          pushToast({
            id: `inbox-${item.id}`,
            title: item.title,
            body: item.body,
            url: item.url || "/admin/cotizaciones",
            tone: "info",
            source: "inbox",
          });
        }
      } catch (err) {
        console.warn("[push] inbox poll failed", err);
      }
    }

    function schedulePoll() {
      if (cancelled) return;
      pollTimer = setTimeout(() => {
        void pollOnce().finally(() => schedulePoll());
      }, POLL_MS);
    }

    function startInboxPolling() {
      if (cancelled) return;
      void pollOnce().finally(() => schedulePoll());
    }

    const cancelIdleBoot = scheduleIdleWork(
      () => {
        if (cancelled) return;
        if ("serviceWorker" in navigator) {
          void ensureFreshServiceWorker().catch((err) => {
            console.warn("[push] service worker register failed", err);
          });
        }
        startInboxPolling();
      },
      { timeoutMs: PUSH_BOOT_DEFER_MS + 2_000, fallbackMs: PUSH_BOOT_DEFER_MS },
    );

    const onVisible = () => {
      if (document.visibilityState === "visible") void pollOnce();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      cancelIdleBoot();
      if (pollTimer) clearTimeout(pollTimer);
      for (const t of toastTimers.values()) clearTimeout(t);
      toastTimers.clear();
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      channel?.close();
      window.removeEventListener(ADMIN_INAPP_TOAST_EVENT, onCustomToast);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    // pushToast/dismiss close over stable refs; mount-once listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminNotificationToasts
      toasts={inAppEnabled ? toasts : []}
      onDismiss={dismiss}
    />
  );
}
