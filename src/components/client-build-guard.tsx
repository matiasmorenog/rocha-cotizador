"use client";

import { useEffect } from "react";
import { APP_BUILD_ID } from "@/lib/app-build-id";
import { forceReloadApp, stripReloadParam } from "@/lib/force-reload-app";
import { scheduleIdleWork } from "@/lib/schedule-idle";

function reloadedForKey(buildId: string): string {
  return `rocha:reloaded-for:${buildId}`;
}

/**
 * Detect a newer deploy while this tab still runs old JS.
 * New tab already gets fresh HTML; same-tab Cmd+Shift+R often does not.
 */
export function ClientBuildGuard() {
  useEffect(() => {
    stripReloadParam();
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const serverId = typeof data.buildId === "string" ? data.buildId : "";
        if (cancelled || !serverId || serverId === APP_BUILD_ID) return;
        try {
          if (sessionStorage.getItem(reloadedForKey(serverId)) === "1") return;
          sessionStorage.setItem(reloadedForKey(serverId), "1");
        } catch {
          // private mode — still try one reload
        }
        await forceReloadApp();
      } catch {
        // offline / blocked
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void check();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void check();
    }

    const cancelIdle = scheduleIdleWork(() => {
      void check();
    });

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      cancelIdle();
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
