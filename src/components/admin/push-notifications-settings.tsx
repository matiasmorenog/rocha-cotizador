"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { SolapasTabButton, SolapasTabList } from "@/components/ui/solapas-tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  ensureFreshServiceWorker,
  getExistingPushSubscription,
  resetServiceWorker,
  dispatchAdminInAppToast,
} from "@/lib/push-sw-client";
import { pushNotificationBrandAssets } from "@/lib/push-notification-brand";
import { patchAdminInAppNotificationsEnabled } from "@/lib/admin-inapp-notifications-pref";

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "no-vapid"
  | "subscribed"
  | "unsubscribed"
  | "error";

type OsGuide = "windows" | "macos" | "android" | "ios";

type TestApiResult = {
  ok: boolean;
  needResub?: boolean;
  error?: string;
  sent?: number;
  total?: number;
  status: number;
};

const OS_GUIDE_LABEL: Record<OsGuide, string> = {
  windows: "Cómo permitir notificaciones en Windows",
  macos: "Cómo permitir notificaciones en macOS",
  android: "Cómo permitir notificaciones en Android",
  ios: "Cómo permitir notificaciones en iOS",
};

const OS_TAB_LABEL: Record<OsGuide, string> = {
  windows: "Windows",
  macos: "macOS",
  android: "Android",
  ios: "iOS",
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

  if (os === "macos") {
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

  if (os === "android") {
    return (
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-700">
        <li>
          En <span className="font-medium">Chrome</span>: candado del sitio →
          Notificaciones → <span className="font-medium">Permitir</span>.
        </li>
        <li>
          En Android: Ajustes → Apps →{" "}
          <span className="font-medium">Chrome</span> → Notificaciones →
          activá notificaciones (y el canal del sitio si aparece).
        </li>
        <li>
          Desactivá <span className="font-medium">No molestar</span> al probar.
        </li>
      </ul>
    );
  }

  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-700">
      <li>
        En iPhone/iPad, Web Push solo funciona si abrís la app desde la{" "}
        <span className="font-medium">pantalla de inicio</span> (PWA), no desde
        una pestaña normal de Safari. Requiere iOS 16.4 o superior.
      </li>
      <li>
        Safari → botón Compartir →{" "}
        <span className="font-medium">Agregar a pantalla de inicio</span> →
        abrí Rocha Cotizador desde el ícono.
      </li>
      <li>
        Dentro de la PWA: Activar notificaciones del sistema y aceptá el
        permiso cuando iOS lo pida.
      </li>
    </ul>
  );
}

export function PushNotificationsSettings() {
  const { data: session, status: sessionStatus, update } = useSession();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [busyInApp, setBusyInApp] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSystem, setTestingSystem] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [osGuide, setOsGuide] = useState<OsGuide>("windows");
  const [perm, setPerm] = useState<NotificationPermission | "unknown">(
    "unknown",
  );

  // From JWT/session — no DB hit on Config visit.
  const inAppPrefLoaded = sessionStatus !== "loading";
  const inAppEnabled =
    session?.user?.inAppNotificationsEnabled !== false;

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
        const existing = await getExistingPushSubscription();
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

  async function syncInAppSession(enabled: boolean) {
    const next = await update({ inAppNotificationsEnabled: enabled });
    if (!next?.user || next.user.inAppNotificationsEnabled !== enabled) {
      throw new Error(
        "Se guardó en el servidor pero la sesión no se actualizó. Recargá la página.",
      );
    }
  }

  async function enableInApp() {
    setBusyInApp(true);
    setError(null);
    setMessage(null);
    try {
      const enabled = await patchAdminInAppNotificationsEnabled(true);
      await syncInAppSession(enabled);
      setMessage("Notificaciones en la app activadas en tu cuenta.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo activar las notificaciones en la app.",
      );
    } finally {
      setBusyInApp(false);
    }
  }

  async function disableInApp() {
    setBusyInApp(true);
    setError(null);
    setMessage(null);
    try {
      const enabled = await patchAdminInAppNotificationsEnabled(false);
      await syncInAppSession(enabled);
      setMessage("Notificaciones en la app desactivadas en tu cuenta.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo desactivar las notificaciones en la app.",
      );
    } finally {
      setBusyInApp(false);
    }
  }

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
        setError(
          "Permiso de notificaciones del sistema denegado. Las notificaciones en la app siguen disponibles si están activadas.",
        );
        return;
      }

      await subscribeFresh(key.publicKey);
      setStatus("subscribed");
      setMessage("Notificaciones del sistema activadas.");
    } catch (err) {
      console.error(err);
      const detail =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      setError(
        `No se pudieron activar las notificaciones del sistema.${detail}`,
      );
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
      setMessage(
        "Notificaciones del sistema desactivadas. Las notificaciones en la app siguen disponibles si están activadas.",
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

    try {
      if (!inAppEnabled) {
        const note =
          "Activá las notificaciones en la app antes de probarlas.";
        setError(note);
        return;
      }

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
    } catch (err) {
      console.error(err);
      const detail =
        err instanceof Error ? err.message : "Error al probar notificaciones.";
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

    try {
      if (status !== "subscribed" || !("Notification" in window)) {
        setError(
          "Activá las notificaciones del sistema antes de probarlas.",
        );
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
        setError(note);
        return;
      }

      // Do not close prior OS toasts — they must stack. Unique tags below
      // prevent the browser from replacing siblings. Fallback only looks
      // for a toast created after this Probar (avoids 2nd-click skip when
      // an older rocha-test* is still open and FCM is silent).
      const requestedAt = Date.now();
      const result = await postPushTest(sub.endpoint);
      if (result.ok) {
        // If FCM delivered but OS UI suppressed, show one local OS toast.
        await new Promise((r) => setTimeout(r, 1200));
        const existing = await reg.getNotifications();
        const hasOs = existing.some((n) => {
          if (typeof n.tag !== "string" || !n.tag.startsWith("rocha-test")) {
            return false;
          }
          // Same-machine show time — ignore older stacked toasts.
          const shownAt = (n as Notification & { timestamp?: number })
            .timestamp;
          if (typeof shownAt === "number") {
            return shownAt >= requestedAt - 50;
          }
          // Tag embeds Date.now() from server or local fallback.
          const m = /^rocha-test(?:-local)?-(\d+)$/.exec(n.tag);
          return m ? Number(m[1]) >= requestedAt - 5_000 : false;
        });
        if (!hasOs && Notification.permission === "granted") {
          const { icon, badge } = pushNotificationBrandAssets(
            window.location.origin,
          );
          await reg.showNotification("Notificación de prueba", {
            body: "Notificación del sistema de Rocha Cotizador.",
            tag: `rocha-test-local-${Date.now()}`,
            renotify: true,
            icon,
            badge,
            silent: false,
            data: { url: "/admin/configuracion" },
          } as NotificationOptions);
        }
        return;
      }

      if (result.needResub) {
        setStatus("unsubscribed");
        setError(
          result.error ??
            "La suscripción expiró. Activá de nuevo las notificaciones del sistema.",
        );
        return;
      }

      setError(
        result.error ?? "No se pudo enviar la notificación del sistema.",
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Error al probar notificaciones del sistema.",
      );
    } finally {
      setTestingSystem(false);
    }
  }

  const statusLabel: Record<Status, string> = {
    loading: "Comprobando…",
    unsupported: "Este navegador no soporta Web Push del sistema.",
    denied:
      "Permiso del sistema bloqueado. Las notificaciones en la app siguen disponibles si están activadas.",
    "no-vapid":
      "Faltan claves VAPID en el servidor (solo afecta notificaciones OS).",
    subscribed: "Notificaciones del sistema activas en este navegador.",
    unsubscribed: "Notificaciones del sistema no activadas.",
    error: "Error al configurar notificaciones del sistema.",
  };

  const osTabs: OsGuide[] = ["windows", "macos", "android", "ios"];

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Cuando un <span className="font-medium">cliente</span> confirma una
        cotización, el admin recibe una notificación. Cotizaciones creadas
        desde el admin no disparan notificación.
      </p>

      {/* —— Notificaciones en la app —— */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
        <p className="font-semibold text-neutral-900">
          Notificaciones en la app
        </p>
        <p className="mt-1 text-neutral-600">
          Con el admin abierto, las notificaciones aparecen como toast abajo a
          la derecha.
        </p>
        <p className="mt-2 text-neutral-800">
          Estado:{" "}
          <span className="font-medium">
            {!inAppPrefLoaded
              ? "Cargando…"
              : inAppEnabled
                ? "Activadas en tu cuenta"
                : "Desactivadas en tu cuenta"}
          </span>
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {inAppEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center sm:w-auto sm:min-w-[17.5rem]"
              disabled={
                !inAppPrefLoaded ||
                busyInApp ||
                testing ||
                testingSystem ||
                busy
              }
              onClick={() => void disableInApp()}
            >
              {busyInApp ? (
                <>
                  <Spinner className="mr-2" />
                  Desactivar notificaciones en la app
                </>
              ) : (
                "Desactivar notificaciones en la app"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full justify-center sm:w-auto sm:min-w-[17.5rem]"
              disabled={
                !inAppPrefLoaded ||
                busyInApp ||
                testing ||
                testingSystem ||
                busy
              }
              onClick={() => void enableInApp()}
            >
              {busyInApp ? (
                <>
                  <Spinner className="mr-2 text-white" />
                  Activar notificaciones en la app
                </>
              ) : (
                "Activar notificaciones en la app"
              )}
            </Button>
          )}
          <Button
            type="button"
            className="w-full justify-center sm:w-auto sm:min-w-[17.5rem]"
            disabled={
              !inAppPrefLoaded ||
              testing ||
              testingSystem ||
              busy ||
              busyInApp ||
              !inAppEnabled
            }
            onClick={() => void testInAppNotification()}
            title={
              !inAppEnabled
                ? "Activá las notificaciones en la app primero"
                : undefined
            }
          >
            {testing ? (
              <>
                <Spinner className="mr-2 text-white" />
                Probar notificación en la app
              </>
            ) : (
              "Probar notificación en la app"
            )}
          </Button>
        </div>
        {!inAppEnabled ? (
          <p className="mt-2 text-xs text-neutral-500">
            Para probar, activá las notificaciones en la app primero.
          </p>
        ) : null}
      </div>

      {/* —— Notificaciones del sistema —— */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
        <p className="font-semibold text-neutral-900">
          Notificaciones del sistema
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

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <span className="pb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Instrucciones OS:
          </span>
          <SolapasTabList
            activeKey={osGuide}
            aria-label="Sistema operativo"
            size="sm"
            className="flex-wrap"
          >
            {osTabs.map((tab) => (
              <SolapasTabButton
                key={tab}
                selected={osGuide === tab}
                size="sm"
                onClick={() => setOsGuide(tab)}
              >
                {OS_TAB_LABEL[tab]}
              </SolapasTabButton>
            ))}
          </SolapasTabList>
        </div>

        <p className="mt-2 font-medium text-neutral-900">
          {OS_GUIDE_LABEL[osGuide]}
        </p>
        <OsSystemGuide os={osGuide} />

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {status === "subscribed" ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center sm:w-auto sm:min-w-[17.5rem]"
              disabled={busy || testing || testingSystem}
              onClick={disable}
            >
              {busy ? (
                <>
                  <Spinner className="mr-2" />
                  Desactivar notificaciones del sistema
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
              className="w-full justify-center sm:w-auto sm:min-w-[17.5rem]"
              disabled={busy || testing || testingSystem}
              onClick={enable}
            >
              {busy ? (
                <>
                  <Spinner className="mr-2 text-white" />
                  Activar notificaciones del sistema
                </>
              ) : (
                "Activar notificaciones del sistema"
              )}
            </Button>
          ) : null}

          <Button
            type="button"
            className="w-full justify-center sm:w-auto sm:min-w-[17.5rem]"
            disabled={
              busy || testing || testingSystem || status !== "subscribed"
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
                Probar notificación del sistema
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
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
