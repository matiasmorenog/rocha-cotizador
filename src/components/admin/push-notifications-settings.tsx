"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "no-vapid"
  | "subscribed"
  | "unsubscribed"
  | "error";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export function PushNotificationsSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      try {
        // Always re-register so push events can wake an active SW.
        const reg = await ensureServiceWorker();
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

  async function enable() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }

      const keyRes = await fetch("/api/admin/push/vapid-public-key");
      const keyData = await keyRes.json().catch(() => ({}));
      if (!keyRes.ok || !keyData.publicKey) {
        setStatus("no-vapid");
        setError(keyData.error ?? "VAPID no configurado en el servidor");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        setError("Permiso de notificaciones denegado o pendiente.");
        return;
      }

      const reg = await ensureServiceWorker();

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            keyData.publicKey as string,
          ),
        });
      }

      const json = sub.toJSON();
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
        setError(data.error ?? "No se pudo guardar la suscripción");
        return;
      }

      setStatus("subscribed");
      setMessage("Avisos del navegador activados.");
    } catch (err) {
      console.error(err);
      setError("No se pudieron activar las notificaciones.");
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
        (await ensureServiceWorker().catch(() => null));
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
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {status === "subscribed" ? (
        <Button type="button" variant="outline" disabled={busy} onClick={disable}>
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
        <Button type="button" disabled={busy} onClick={enable}>
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
    </div>
  );
}
