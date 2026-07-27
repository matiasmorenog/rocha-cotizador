"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ensureFreshServiceWorker,
  resetServiceWorker,
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

type OsGuide = "windows" | "macos";

type TestApiResult = {
  ok: boolean;
  needResub?: boolean;
  error?: string;
  sent?: number;
  total?: number;
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
      // continue
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
    sent: typeof data.sent === "number" ? data.sent : undefined,
    total: typeof data.total === "number" ? data.total : undefined,
    status: res.status,
  };
}

function OsSystemGuide({ os }: { os: OsGuide }) {
  if (os === "windows") {
    return (
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-700">
        <li>
          <span className="font-medium">Windows</span> → Configuración →
          Sistema → Notificaciones → activá notificaciones y asegurate de que{" "}
          <span className="font-medium">Google Chrome</span> o{" "}
          <span className="font-medium">Microsoft Edge</span> estén permitidos
          (no “Prioridad baja” / silenciadas).
        </li>
        <li>
          Desactivá <span className="font-medium">No molestar</span> / Focus
          assist al probar.
        </li>
        <li>
          En Chrome/Edge: candado del sitio → Notificaciones →{" "}
          <span className="font-medium">Permitir</span>.
        </li>
        <li>
          Pegá en la barra:{" "}
          <span className="break-all font-mono text-xs">
            chrome://settings/content/notifications
          </span>{" "}
          (o{" "}
          <span className="break-all font-mono text-xs">
            edge://settings/content/notifications
          </span>
          ).
        </li>
      </ul>
    );
  }

  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-700">
      <li>
        <span className="font-medium">Ajustes macOS</span> → Notificaciones →
        Google Chrome → <span className="font-medium">Permitir</span> (no
        “Entregar en silencio” / Deliver Quietly).
      </li>
      <li>
        Desactivá <span className="font-medium">Focus / No molestar</span> al
        probar. En Chrome: desmarcá{" "}
        <span className="font-medium">“Use Focus filters”</span> si aparece.
      </li>
      <li>
        Chrome → candado del sitio → Notificaciones →{" "}
        <span className="font-medium">Permitir</span>.
      </li>
      <li>
        Pegá en la barra:{" "}
        <span className="break-all font-mono text-xs">
          chrome://settings/content/notifications
        </span>
        .
      </li>
    </ul>
  );
}

export function PushNotificationsSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSystem, setTestingSystem] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probar, setProbar] = useState<ProbarReport | null>(null);
  const [probarSystem, setProbarSystem] = useState<{
    ok: boolean;
    note: string;
  } | null>(null);
  const [osGuide, setOsGuide] = useState<OsGuide>("windows");
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

  async function enable() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setProbar(null);
    setProbarSystem(null);

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
        setError(
          "Permiso de notificaciones del sistema denegado. Las notificaciones en la app siguen funcionando con el admin abierto.",
        );
        return;
      }

      await subscribeFresh(key.publicKey);
      setStatus("subscribed");
      setMessage(
        "Notificaciones del sistema activadas.",
      );
    } catch (err) {
      console.error(err);
      const detail =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      setError(`No se pudieron activar las notificaciones del sistema.${detail}`);
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
    setProbarSystem(null);

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
      setMessage(
        "Notificaciones del sistema desactivadas. Las notificaciones en la app siguen activas.",
      );
    } catch {
      setError("No se pudieron desactivar las notificaciones del sistema.");
    } finally {
      setBusy(false);
    }
  }

  /** In-app toast test only (inbox). */
  async function testInAppNotification() {
    setTesting(true);
    setError(null);
    setMessage(null);
    setProbar(null);
    setProbarSystem(null);

    try {
      const inboxRes = await fetch("/api/admin/push/inbox/test", {
        method: "POST",
        credentials: "same-origin",
      });
      const inboxData = await inboxRes.json().catch(() => ({}));
      if (!inboxRes.ok || !inboxData.item) {
        const note =
          typeof inboxData.error === "string"
            ? inboxData.error
            : "No se pudo enviar la notificación de prueba. Revisá la sesión o la red.";
        setProbar({
          ok: false,
          steps: [{ label: "Notificación en la app", ok: false, detail: note }],
          note,
        });
        setError(note);
        dispatchAdminInAppToast({
          title: "Prueba fallida",
          body: note,
          tone: "error",
        });
        return;
      }

      const item = inboxData.item as {
        id: string;
        title: string;
        body: string;
        url: string;
      };
      dispatchAdminInAppToast({
        title: item.title,
        body: item.body,
        url: item.url,
        tone: "success",
        inboxId: item.id,
      });
      const report: ProbarReport = {
        ok: true,
        steps: [
          {
            label: "Notificación en la app",
            ok: true,
            detail: "Notificación de prueba enviada",
          },
        ],
        note: "Notificación de prueba enviada.",
      };
      setProbar(report);
      setMessage(report.note);
    } catch (err) {
      console.error(err);
      const detail =
        err instanceof Error ? err.message : "Error al probar notificaciones.";
      setProbar({
        ok: false,
        steps: [{ label: "Notificación en la app", ok: false, detail }],
        note: detail,
      });
      setError(detail);
      dispatchAdminInAppToast({
        title: "Prueba fallida",
        body: detail,
        tone: "error",
      });
    } finally {
      setTesting(false);
    }
  }

  /** OS / Web Push test via POST /api/admin/push/test. */
  async function testSystemNotification() {
    setTestingSystem(true);
    setError(null);
    setMessage(null);
    setProbarSystem(null);

    try {
      if (status !== "subscribed" || !("Notification" in window)) {
        const note =
          "Activá las notificaciones del sistema antes de probarlas.";
        setProbarSystem({ ok: false, note });
        setError(note);
        return;
      }

      // Prefer existing registration — avoid update() racing the push.
      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await ensureFreshServiceWorker());
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const note =
          "Sin suscripción en este navegador. Activá las notificaciones del sistema.";
        setStatus("unsubscribed");
        setProbarSystem({ ok: false, note });
        setError(note);
        return;
      }

      const result = await postPushTest(sub.endpoint);
      if (result.ok) {
        // If FCM delivered but OS UI suppressed, show one local OS toast.
        await new Promise((r) => setTimeout(r, 1200));
        const existing = await reg.getNotifications();
        const hasOs = existing.some(
          (n) =>
            typeof n.tag === "string" && n.tag.startsWith("rocha-test"),
        );
        if (!hasOs && Notification.permission === "granted") {
          await reg.showNotification("Notificación de prueba", {
            body: "Notificación del sistema de Rocha Cotizador.",
            tag: `rocha-test-local-${Date.now()}`,
            icon: "/brand/rocha-logo.png",
            silent: false,
            data: { url: "/admin/configuracion" },
          });
        }
        const note = "Notificación del sistema enviada.";
        setProbarSystem({ ok: true, note });
        setMessage(note);
        return;
      }

      if (result.needResub) {
        setStatus("unsubscribed");
        const note =
          result.error ??
          "La suscripción expiró. Activá de nuevo las notificaciones del sistema.";
        setProbarSystem({ ok: false, note });
        setError(note);
        return;
      }

      const note =
        result.error ?? "No se pudo enviar la notificación del sistema.";
      setProbarSystem({ ok: false, note });
      setError(note);
    } catch (err) {
      console.error(err);
      const detail =
        err instanceof Error
          ? err.message
          : "Error al probar notificaciones del sistema.";
      setProbarSystem({ ok: false, note: detail });
      setError(detail);
    } finally {
      setTestingSystem(false);
    }
  }

  const statusLabel: Record<Status, string> = {
    loading: "Comprobando…",
    unsupported: "Este navegador no soporta Web Push del sistema.",
    denied:
      "Permiso del sistema bloqueado. Las notificaciones en la app siguen funcionando.",
    "no-vapid": "Faltan claves VAPID en el servidor (solo afecta notificaciones OS).",
    subscribed: "Notificaciones del sistema activas en este navegador.",
    unsubscribed: "Notificaciones del sistema no activadas (opcional).",
    error: "Error al configurar notificaciones del sistema.",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Cuando un <span className="font-medium">cliente</span> confirma una
        cotización, el admin recibe una notificación. Cotizaciones creadas desde el
        admin no disparan notificación.
      </p>

      {/* —— Notificaciones en la app —— */}
      <div className="rounded-md border-2 border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
        <p className="font-semibold">Notificaciones en la app</p>
        <p className="mt-1 text-emerald-900/90">
          Con el admin abierto, las notificaciones aparecen como toast abajo a
          la derecha.
        </p>
        <div className="mt-3">
          <Button
            type="button"
            disabled={testing || testingSystem || busy}
            onClick={testInAppNotification}
          >
            {testing ? (
              <>
                <Spinner className="mr-2 text-white" />
                Probando…
              </>
            ) : (
              "Probar notificación en la app"
            )}
          </Button>
        </div>
      </div>

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
              ? "Notificación de prueba enviada"
              : "No se pudo enviar la notificación de prueba"}
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

      {/* —— Notificaciones del sistema (opcional) —— */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
        <p className="font-semibold text-neutral-900">
          Notificaciones del sistema (opcional)
        </p>
        <p className="mt-1 text-neutral-600">
          Notificaciones del navegador cuando el admin está cerrado o en
          segundo plano. Requiere permiso del sistema operativo. El sonido es
          el del sistema (el navegador no permite un sonido custom fiable).
        </p>
        <p className="mt-2 text-neutral-800">
          Estado: <span className="font-medium">{statusLabel[status]}</span>
          {perm !== "unknown" ? (
            <>
              {" "}
              · Permiso: <span className="font-medium">{perm}</span>
            </>
          ) : null}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Instrucciones OS:
          </span>
          <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5">
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                osGuide === "windows"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              onClick={() => setOsGuide("windows")}
              aria-pressed={osGuide === "windows"}
            >
              Windows
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                osGuide === "macos"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              onClick={() => setOsGuide("macos")}
              aria-pressed={osGuide === "macos"}
            >
              macOS
            </button>
          </div>
        </div>

        <p className="mt-2 font-medium text-neutral-900">
          {osGuide === "windows"
            ? "Cómo permitir notificaciones en Windows"
            : "Cómo permitir notificaciones en macOS"}
        </p>
        <OsSystemGuide os={osGuide} />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status === "subscribed" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || testing || testingSystem}
              onClick={disable}
            >
              {busy ? (
                <>
                  <Spinner className="mr-2" />
                  Desactivando…
                </>
              ) : (
                "Desactivar notificaciones del sistema"
              )}
            </Button>
          ) : status !== "unsupported" &&
            status !== "denied" &&
            status !== "loading" ? (
            <Button
              type="button"
              disabled={busy || testing || testingSystem}
              onClick={enable}
            >
              {busy ? (
                <>
                  <Spinner className="mr-2 text-white" />
                  Activando…
                </>
              ) : (
                "Activar notificaciones del sistema"
              )}
            </Button>
          ) : null}

          <Button
            type="button"
            disabled={
              busy ||
              testing ||
              testingSystem ||
              status !== "subscribed"
            }
            onClick={testSystemNotification}
            title={
              status !== "subscribed"
                ? "Activá las notificaciones del sistema primero"
                : undefined
            }
          >
            {testingSystem ? (
              <>
                <Spinner className="mr-2 text-white" />
                Probando…
              </>
            ) : (
              "Probar notificación del sistema"
            )}
          </Button>
        </div>
        {status !== "subscribed" &&
        status !== "loading" &&
        status !== "unsupported" ? (
          <p className="mt-2 text-xs text-neutral-500">
            Para probar el sistema, activá las notificaciones del sistema
            primero.
          </p>
        ) : null}
        {probarSystem ? (
          <p
            className={`mt-2 text-sm font-medium ${
              probarSystem.ok ? "text-green-700" : "text-red-600"
            }`}
          >
            {probarSystem.note}
          </p>
        ) : null}
      </div>

      {error && !probar && !probarSystem ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
      {message && !probar && !probarSystem ? (
        <p className="text-sm text-green-700">{message}</p>
      ) : null}
    </div>
  );
}
