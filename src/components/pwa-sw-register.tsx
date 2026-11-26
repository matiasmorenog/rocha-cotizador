"use client";

import { useEffect } from "react";
import { ensureFreshServiceWorker } from "@/lib/push-sw-client";
import { ensureInstallPromptCapture } from "@/lib/pwa-install-client";

/**
 * Registers `/sw.js` site-wide so Chrome can treat the app as installable.
 * Same worker as admin Web Push — no second SW, no push subscribe here.
 * AdminPushSwRegister still owns push inbox / toast / subscribe UX.
 */
export function PwaSwRegister() {
  useEffect(() => {
    ensureInstallPromptCapture();
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      void ensureFreshServiceWorker().catch((err) => {
        console.warn("[pwa] service worker register failed", err);
      });
    }, 1_500);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return null;
}
