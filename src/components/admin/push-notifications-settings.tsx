"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ensureFreshServiceWorker,
  resetServiceWorker,
  PUSH_BROADCAST_CHANNEL,
  dispatchAdminInAppToast,
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

type StepResult = {
  label: string;
  ok: boolean;
  detail: string;
};

type ProbarReport = {
  ok: boolean;
  steps: StepResult[];
  note: string;
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

  const verifyRes = await fetch("/api/admin/push/subscribe");
  const verifyData = await verifyRes.json().catch(() => ({}));
  const stored: string[] = Array.isArray(verifyData.endpoints)
    ? verifyData.endpoints
    : [];
  if (!stored.includes(json.endpoint)) {
    console.error("[push] endpoint mismatch after Activar", {
      browser: json.endpoint,
      stored,
    });
    throw new Error(
      "Suscripción guardada no coincide con este navegador. Reintentá Activar.",
    );
  }
  console.log("[push] endpoint verified in DB", json.endpoint.slice(-48));
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

function MacOsChecklist() {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
      <p className="font-semibold text-neutral-900">
        Checklist macOS / Chrome (si no ves el toast del sistema)
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-700">
        <li>
          <span className="font-medium">Ajustes macOS</span> → Notificaciones →
          Google Chrome → <span className="font-medium">Permitir</span>{" "}
          (no “Entregar en silencio” / Deliver Quietly).
        </li>
        <li>
          Desactivá <span className="font-medium">Focus / No molestar</span> al
          probar. En Chrome: Configuración → Privacidad → Notificaciones del
          sitio → desmarcá{" "}
          <span className="font-medium">“Use Focus filters”</span> si está.
        </li>
        <li>
          Chrome → candado del sitio (localhost) → Notificaciones →{" "}
          <span className="font-medium">Permitir</span>.
        </li>
      </ul>
      <p className="mt-2 text-xs text-neutral-600">
        Nota: Focus a menudo oculta toasts del service worker, pero el aviso
        verde/rojo <span className="font-medium">dentro de la página</span>{" "}
        siempre debería aparecer. Eso confirma que el push funciona aunque el
        OS lo silencie.
      </p>
      <p className="mt-2 break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-neutral-600">
        chrome://settings/content/notifications
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Pegá esa URL en la barra de Chrome (las páginas web no pueden abrirla
        solas).
      </p>
    </div>
  );
}

export function PushNotificationsSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probar, setProbar] = useState<ProbarReport | null>(null);
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

  // Dual path: when /admin tab open, SW still showNotification + also posts here
  // (settings page also gets the global banner via AdminPushSwRegister).
  useEffect(() => {
    function onPushMessage(raw: unknown) {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as Record<string, unknown>;
      if (msg.type !== "ROCHA_PUSH") return;
      const title =
        typeof msg.title === "string" ? msg.title : "Nueva cotización";
      const body = typeof msg.body === "string" ? msg.body : "";
      console.log("[push] settings page SW message", { title, body });
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
    setProbar(null);

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
      dispatchAdminInAppToast({
        title: "Avisos activados",
        body: "Suscripción Web Push verificada. Si macOS oculta el toast, este banner confirma que funciona.",
        url: "/admin/configuracion",
        tone: "success",
      });
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
    setProbar(null);

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
    setProbar(null);

    const steps: StepResult[] = [];

    function finish(ok: boolean, note: string) {
      const report: ProbarReport = { ok, steps: [...steps], note };
      setProbar(report);
      dispatchAdminInAppToast({
        title: ok
          ? "Prueba OK (aviso in-app)"
          : "Prueba FALLÓ (aviso in-app)",
        body: [
          ...steps.map(
            (s) => `${s.ok ? "✓" : "✗"} ${s.label}: ${s.detail}`,
          ),
          note,
        ].join(" · "),
        url: "/admin/configuracion",
        tone: ok ? "success" : "error",
      });
      if (!ok) {
        setError(note);
      } else {
        setMessage(note);
      }
    }

    try {
      if (!("Notification" in window)) {
        steps.push({
          label: "Local",
          ok: false,
          detail: "Notification API no disponible",
        });
        finish(false, "Notification API no disponible.");
        return;
      }

      setPerm(Notification.permission);
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        setPerm(p);
        if (p !== "granted") {
          steps.push({
            label: "Local",
            ok: false,
            detail: `permiso = ${p}`,
          });
          finish(
            false,
            `Permiso Notification = ${p}. Activá permisos OS/Chrome primero.`,
          );
          return;
        }
      }

      // 1) Direct Notification — proves OS permission (may still be silenced by Focus).
      try {
        const n = new Notification("Prueba local (sin push)", {
          body: "Si ves el toast OS, permiso OK. Si no, mirá Focus / Deliver Quietly — el panel verde de abajo igual cuenta.",
          requireInteraction: true,
          tag: `rocha-local-${Date.now()}`,
        });
        n.onclick = () => n.close();
        steps.push({
          label: "1) Local (new Notification)",
          ok: true,
          detail: "API OK — toast OS puede estar oculto por Focus",
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        steps.push({
          label: "1) Local (new Notification)",
          ok: false,
          detail,
        });
        finish(false, `Notification local falló: ${detail}`);
        return;
      }

      const key = await fetchVapidPublicKey();
      if ("error" in key) {
        if (key.noVapid) setStatus("no-vapid");
        steps.push({
          label: "2) Push API",
          ok: false,
          detail: key.error,
        });
        finish(false, key.error);
        return;
      }

      const { result, didResub } = await testPushWithResubRetry(key.publicKey);

      if (!result.ok) {
        setStatus("unsubscribed");
        const detail = result.needResub
          ? `${result.error ?? result.status} — Activá avisos de nuevo`
          : (result.error ?? String(result.status));
        steps.push({
          label: "2) Push API",
          ok: false,
          detail,
        });
        finish(false, `Push API falló: ${detail}`);
        return;
      }

      setStatus("subscribed");
      const sent =
        result.sent != null && result.total != null
          ? `${result.sent}/${result.total}`
          : "ok";
      steps.push({
        label: "2) Push API",
        ok: true,
        detail: didResub
          ? `suscripción renovada, enviado ${sent}`
          : `enviado ${sent}`,
      });

      // 3) Belt: registration.showNotification from page
      try {
        const reg = await ensureFreshServiceWorker();
        await reg.showNotification("Prueba desde página (belt)", {
          body: "Push API OK. registration.showNotification desde la página.",
          requireInteraction: true,
          tag: `rocha-page-${Date.now()}`,
          data: { url: "/admin/configuracion" },
        });
        steps.push({
          label: "3) Belt (showNotification)",
          ok: true,
          detail: "API OK — toast OS puede estar oculto por Focus",
        });
        console.log("[push] page showNotification ok after push API");
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        steps.push({
          label: "3) Belt (showNotification)",
          ok: false,
          detail,
        });
        console.error("[push] page showNotification failed", err);
        finish(
          false,
          `Push OK pero showNotification falló: ${detail}`,
        );
        return;
      }

      finish(
        true,
        "Local + Push + Belt OK. Si no hay toast macOS, Focus/Deliver Quietly lo ocultan — el banner verde de arriba y este panel confirman éxito.",
      );
    } catch (err) {
      console.error(err);
      const detail =
        err instanceof Error
          ? err.message
          : "Error al probar notificaciones.";
      if (steps.length === 0) {
        steps.push({ label: "Prueba", ok: false, detail });
      }
      finish(false, detail);
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
    <div className="space-y-4">
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

      <MacOsChecklist />

      {error && !probar ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
      {message && !probar ? (
        <p className="text-sm text-green-700">{message}</p>
      ) : null}

      {probar ? (
        <div
          role="alert"
          aria-live="assertive"
          className={`rounded-lg border-2 px-4 py-4 shadow-md ${
            probar.ok
              ? "border-emerald-600 bg-emerald-50 text-emerald-950"
              : "border-red-600 bg-red-50 text-red-950"
          }`}
        >
          <p className="text-base font-bold sm:text-lg">
            {probar.ok
              ? "Resultado de la prueba: OK"
              : "Resultado de la prueba: FALLÓ"}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide opacity-80">
            Aviso dentro de la página — no depende del toast de macOS
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {probar.steps.map((step) => (
              <li
                key={step.label}
                className="flex gap-2 rounded-md bg-white/70 px-3 py-2"
              >
                <span className="font-bold" aria-hidden>
                  {step.ok ? "✓" : "✗"}
                </span>
                <span>
                  <span className="font-semibold">{step.label}</span>
                  <span className="block text-neutral-700">{step.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium">{probar.note}</p>
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
