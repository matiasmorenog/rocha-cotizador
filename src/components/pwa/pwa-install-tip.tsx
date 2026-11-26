"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  dismissInstallTip,
  ensureInstallPromptCapture,
  isPwaInstallTipViewport,
  isPwaStandalone,
  PWA_INSTALL_TIP_EVENT,
  readInstallTipDismissed,
} from "@/lib/pwa-install-client";
import { PwaInstallActions } from "@/components/pwa/pwa-install-actions";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

function subscribeTip(onStoreChange: () => void) {
  window.addEventListener(PWA_INSTALL_TIP_EVENT, onStoreChange);
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener(PWA_INSTALL_TIP_EVENT, onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

/** Cached server snapshot — must be referentially stable. */
const SERVER_TIP_KEY = "1:0";

let cachedTipKey = SERVER_TIP_KEY;

/** Stable string: dismissed:eligible */
function getTipKey(): string {
  const dismissed = readInstallTipDismissed() ? "1" : "0";
  const eligible =
    !isPwaStandalone() && isPwaInstallTipViewport() ? "1" : "0";
  const next = `${dismissed}:${eligible}`;
  if (next !== cachedTipKey) cachedTipKey = next;
  return cachedTipKey;
}

function getServerTipKey(): string {
  return SERVER_TIP_KEY;
}

/**
 * One-shot tip after login (admin + customer): mobile, non-standalone, until dismissed.
 */
export function PwaInstallTip({ show }: { show: boolean }) {
  const tipKey = useSyncExternalStore(subscribeTip, getTipKey, getServerTipKey);
  const [dismissed, eligible] = tipKey.split(":") as ["0" | "1", "0" | "1"];

  useEffect(() => {
    if (show) ensureInstallPromptCapture();
  }, [show]);

  if (!show || dismissed === "1" || eligible !== "1") return null;

  return (
    <div
      role="status"
      className="border-b border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]/90 print:hidden"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-1 text-sm text-[var(--foreground)]">
          <p className="font-medium">Instalá Rocha en el inicio</p>
          <PwaInstallActions compact />
        </div>
        <button
          type="button"
          onClick={() => dismissInstallTip()}
          className={cn(
            "shrink-0 self-end rounded-md border border-[var(--brand-primary)]/30 bg-white px-3 py-1 text-sm text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] sm:self-center",
            FOCUS_BRAND_OUTLINE,
          )}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
