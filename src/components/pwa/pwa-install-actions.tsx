"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ensureInstallPromptCapture,
  getDeferredInstallPrompt,
  isIosDevice,
  isPwaStandalone,
  promptPwaInstall,
  PWA_INSTALL_PROMPT_EVENT,
} from "@/lib/pwa-install-client";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

function subscribePrompt(onStoreChange: () => void) {
  window.addEventListener(PWA_INSTALL_PROMPT_EVENT, onStoreChange);
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener(PWA_INSTALL_PROMPT_EVENT, onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

/** Cached server snapshot — must be referentially stable. */
const SERVER_ENV_KEY = "0:1:0";

let cachedEnvKey = SERVER_ENV_KEY;

/** Stable string snapshot for useSyncExternalStore. */
function getEnvKey(): string {
  const hasPrompt = getDeferredInstallPrompt() !== null ? "1" : "0";
  const standalone = isPwaStandalone() ? "1" : "0";
  const ios = isIosDevice() ? "1" : "0";
  const next = `${hasPrompt}:${standalone}:${ios}`;
  if (next !== cachedEnvKey) cachedEnvKey = next;
  return cachedEnvKey;
}

function getServerEnvKey(): string {
  return SERVER_ENV_KEY;
}

type Props = {
  /** Compact row for the post-login tip. */
  compact?: boolean;
  className?: string;
};

/**
 * Shared install CTA / iOS instructions.
 * Android Chrome: native prompt when `beforeinstallprompt` fired.
 * iOS: Share → Agregar a pantalla de inicio.
 */
export function PwaInstallActions({ compact = false, className }: Props) {
  const envKey = useSyncExternalStore(subscribePrompt, getEnvKey, getServerEnvKey);
  const [hasPrompt, standalone, ios] = envKey.split(":") as ["0" | "1", "0" | "1", "0" | "1"];
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureInstallPromptCapture();
  }, []);

  const onInstall = useCallback(async () => {
    setBusy(true);
    try {
      await promptPwaInstall();
    } finally {
      setBusy(false);
    }
  }, []);

  if (standalone === "1") {
    return (
      <p className={cn("text-sm text-neutral-600", className)}>
        Ya está abierta como app instalada.
      </p>
    );
  }

  if (hasPrompt === "1") {
    return (
      <div className={cn(compact ? "flex flex-wrap items-center gap-2" : "space-y-2", className)}>
        {!compact ? (
          <p className="text-sm text-neutral-600">
            Instalá Rocha Cotizador en el inicio para abrirla más rápido, como una app.
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void onInstall()}
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60",
            FOCUS_BRAND_PRIMARY,
          )}
        >
          {busy ? "Instalando…" : "Instalar app"}
        </button>
      </div>
    );
  }

  if (ios === "1") {
    return (
      <p className={cn("text-sm text-neutral-700", className)}>
        En Safari: tocá{" "}
        <span className="font-medium">Compartir</span> →{" "}
        <span className="font-medium">Agregar a pantalla de inicio</span> → Agregar.
      </p>
    );
  }

  return (
    <p className={cn("text-sm text-neutral-700", className)}>
      {compact ? (
        <>
          Menú del navegador (⋮) →{" "}
          <span className="font-medium">Instalar app</span> /{" "}
          <span className="font-medium">Agregar a la pantalla de inicio</span>.
        </>
      ) : (
        <>
          En Chrome o Edge del celular: menú{" "}
          <span className="font-medium">⋮</span> →{" "}
          <span className="font-medium">Instalar app</span> o{" "}
          <span className="font-medium">Agregar a la pantalla de inicio</span>.
          En iPhone/iPad (Safari):{" "}
          <span className="font-medium">Compartir</span> →{" "}
          <span className="font-medium">Agregar a pantalla de inicio</span>.
        </>
      )}
    </p>
  );
}
