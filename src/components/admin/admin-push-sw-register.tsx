"use client";

import { useEffect } from "react";

/**
 * Keep the admin Web Push service worker registered whenever an admin
 * session loads. Enable() also registers, but getRegistration("/") alone
 * is not enough if the SW was cleared or never installed after subscribe.
 */
export function AdminPushSwRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.update().catch(() => undefined))
      .catch((err) => {
        console.warn("[push] service worker register failed", err);
      });
  }, []);

  return null;
}
