"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ensureFreshServiceWorker,
  resetServiceWorker,
  PUSH_BROADCAST_CHANNEL,
} from "@/lib/push-sw-client";

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "no-vapid"
  | "subscribed"
  | "unsubscribed"
  | "error";

type TestApiResult = {
  ok: boolean;
  needResub?: boolean;
  error?: string;
  message?: string;
  sent?: number;
  total?: number;
  staleRemoved?: number;
  status: number;
};

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidPublicKey(): Promise<
  { publicKey: string } | { error: string; noVapid?: boolean }
> {
  const keyRes = await fetch("/api/admin/push/vapid-public-key");
  const keyData = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !keyData.publicKey) {
    return {
      error: keyData.error ?? "VAPID no configurado en el servidor",
      noVapid: true,
    };
  }
  return { publicKey: keyData.publicKey as string };
}

/** Drop browser + DB sub, reset SW, subscribe fresh, POST to server. */
async function subscribeFresh(publicKey: string): Promise<PushSubscription> {
  const existingReg = await navigator.serviceWorker.getRegistration("/");
  const existing = existingReg
    ? await existingReg.pushManager.getSubscription()
    : null;
  if (existing) {
    try {
      await fetch("/api/admin/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      });
    } catch {
      // continue — local unsubscribe still needed
    }
    await existing.unsubscribe().catch(() => undefined);
  }

  const reg = await resetServiceWorker();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("El navegador no devolvió una suscripción válida.");
  }

  const res = await fetch("/api/admin/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "No se pudo guardar la suscripción");
  }
  return sub;
}

async function postPushTest(endpoint: string): Promise<TestApiResult> {
  const res = await fetch("/api/admin/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: Boolean(res.ok && data.ok === true),
    needResub:
      Boolean(data.needResub) || res.status === 410 || res.status === 404,
    error: typeof data.error === "string" ? data.error : undefined,
    message: typeof data.message === "string" ? data.message : undefined,
    sent: typeof data.sent === "number" ? data.sent : undefined,
    total: typeof data.total === "number" ? data.total : undefined,
    staleRemoved:
      typeof data.staleRemoved === "number" ? data.staleRemoved : undefined,
    status: res.status,
  };
}

/**
 * Send test push. On failure, refresh VAPID subscription once and retry.
 */
async function testPushWithResubRetry(
  publicKey: string,
): Promise<{ result: TestApiResult; didResub: boolean }> {
  const reg = await ensureFreshServiceWorker();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await subscribeFresh(publicKey);
    const result = await postPushTest(sub.endpoint);
    return { result, didResub: true };
  }

  let result = await postPushTest(sub.endpoint);
  if (result.ok) return { result, didResub: false };

  sub = await subscribeFresh(publicKey);
  result = await postPushTest(sub.endpoint);
  return { result, didResub: true };
}

type InAppPush = { title: string; body: string; url: string };

export function PushNotificationsSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inApp, setInApp] = useState<InAppPush | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unknown">(
    "unknown",
  );

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setError(null);
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      setPerm(Notification.permission);

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      try {
        const reg = await ensureFreshServiceWorker();
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(existing ? "subscribed" : "unsubscribed");
        }
      } catch {
        if (!cancelled) setStatus("unsubscribed");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Dual path: when /admin tab open, SW still showNotification + also posts here.
  useEffect(() => {
    function onPushMessage(raw: unknown) {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as Record<string, unknown>;
      if (msg.type !== "ROCHA_PUSH") return;
      const title = typeof msg.title === "string" ? msg.title : "Rocha Cotizador";
      const body = typeof msg.body === "string" ? msg.body : "";
      const url =
        typeof msg.url === "string" ? msg.url : "/admin/cotizaciones";
      console.log("[push] in-app fallback received", { title, body, url });
      setInApp({ title, body, url });
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
      // BroadcastChannel unsupported
    }

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      channel?.close();
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }

      const key = await fetchVapidPublicKey();
      if ("error" in key) {
        if (key.noVapid) setStatus("no-vapid");
        setError(key.error);
        return;
      }

      const permission = await Notification.requestPermission();
      setPerm(permission);
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        setError("Permiso de notificaciones denegado o pendiente.");
        return;
      }

      await subscribeFresh(key.publicKey);

      // Silent verify — if FCM already stale/mismatch, resub once and retest.
      const { result, didResub } = await testPushWithResubRetry(key.publicKey);
      if (!result.ok) {
        setStatus("unsubscribed");
        setError(
          result.error ??
            "Suscripción expirada — Activá avisos de nuevo",
        );
        return;
      }

      setStatus("subscribed");
      setMessage(
        didResub
          ? "Avisos activados (suscripción renovada y verificada)."
          : "Avisos del navegador activados y verificados.",
      );
    } catch (err) {
      console.error(err);
      const detail =
        err instanceof Error && err.message
          ? ` (${err.message})`
          : "";
      setError(`No se pudieron activar las notificaciones.${detail}`);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await ensureFreshServiceWorker().catch(() => null));
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/admin/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
      setMessage("Avisos desactivados en este navegador.");
    } catch {
      setError("No se pudieron desactivar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function testNotification() {
    setTesting(true);
    setError(null);
    setMessage(null);
    setInApp(null);

    const lines: string[] = [];

    try {
      if (!("Notification" in window)) {
        setError("Notification API no disponible.");
        return;
      }

      setPerm(Notification.permission);
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        setPerm(p);
        if (p !== "granted") {
          setError(
            `Permiso Notification = ${p}. Activá permisos OS/Chrome primero.`,
          );
          return;
        }
      }

      // 1) Direct Notification — proves OS permission + banners not blocked.
      try {
        const n = new Notification("Prueba local (sin push)", {
          body: "Si ves esto, permiso OS OK. Si el push falla después → SW.",
          requireInteraction: true,
          tag: `rocha-local-${Date.now()}`,
        });
        n.onclick = () => n.close();
        lines.push("1) Notification local: OK (deberías ver toast OS).");
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        lines.push(`1) Notification local: FALLÓ (${detail}).`);
        setError(lines.join(" "));
        return;
      }

      const key = await fetchVapidPublicKey();
      if ("error" in key) {
        if (key.noVapid) setStatus("no-vapid");
        lines.push(`2) Push: ${key.error}`);
        setError(lines.join(" "));
        return;
      }

      const { result, didResub } = await testPushWithResubRetry(key.publicKey);

      if (!result.ok) {
        setStatus("unsubscribed");
        lines.push(
          `2) Push API: FALLÓ (${result.error ?? result.status}). ${
            result.needResub
              ? "Suscripción expirada — Activá avisos de nuevo."
              : "Mirá logs server."
          }`,
        );
        setError(lines.join(" "));
        return;
      }

      setStatus("subscribed");
      const sent =
        result.sent != null && result.total != null
          ? `${result.sent}/${result.total}`
          : "ok";
      lines.push(
        didResub
          ? `2) Push API: suscripción renovada, enviado (${sent}). Esperá toast SW.`
          : `2) Push API: enviado (${sent}). Esperá toast SW; si no, Application → Service Workers → console.`,
      );
      setMessage(lines.join(" "));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Error al probar notificaciones.",
      );
    } finally {
      setTesting(false);
    }
  }

  const statusLabel: Record<Status, string> = {
    loading: "Comprobando…",
    unsupported: "Este navegador no soporta Web Push.",
    denied:
      "Permiso bloqueado. Habilitalo en la configuración del navegador para este sitio.",
    "no-vapid": "Faltan claves VAPID en el servidor.",
    subscribed: "Activos en este navegador.",
    unsubscribed: "No activados en este navegador.",
    error: "Error al configurar avisos.",
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">
        Recibí un aviso en Chrome (escritorio o móvil) cuando un{" "}
        <span className="font-medium">cliente</span> confirme una cotización,
        aunque no tengas el admin abierto. Cotizaciones creadas desde el admin
        no disparan aviso.
      </p>
      <p className="text-sm text-neutral-800">
        Estado: <span className="font-medium">{statusLabel[status]}</span>
        {perm !== "unknown" ? (
          <>
            {" "}
            · Permiso: <span className="font-medium">{perm}</span>
          </>
        ) : null}
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {inApp ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">{inApp.title}</p>
          <p>{inApp.body}</p>
          <p className="mt-1 text-xs text-amber-800">
            Fallback in-app (tab abierta). Toast OS también debería aparecer.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "subscribed" ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy || testing}
            onClick={disable}
          >
            {busy ? (
              <>
                <Spinner className="mr-2" />
                Desactivando…
              </>
            ) : (
              "Desactivar avisos"
            )}
          </Button>
        ) : status !== "unsupported" &&
          status !== "denied" &&
          status !== "loading" ? (
          <Button type="button" disabled={busy || testing} onClick={enable}>
            {busy ? (
              <>
                <Spinner className="mr-2 text-white" />
                Activando…
              </>
            ) : (
              "Activar avisos del navegador"
            )}
          </Button>
        ) : null}

        {status !== "unsupported" && status !== "loading" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || testing}
            onClick={testNotification}
          >
            {testing ? (
              <>
                <Spinner className="mr-2" />
                Probando…
              </>
            ) : (
              "Probar notificación"
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
