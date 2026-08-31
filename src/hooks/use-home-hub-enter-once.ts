"use client";

import { usePathname } from "next/navigation";
import { useRouteLoading } from "@/lib/route-loading-context";

function isHomePath(path: string) {
  return path === "/" || path === "";
}

/**
 * Home hub card stagger when `/` is visible after route settle.
 * Replays on each return from a module; skips while pending overlay is up.
 */
export function useHomeHubEnterOnce() {
  const pathname = usePathname();
  const { pending } = useRouteLoading();
  const onHome = isHomePath(pathname);
  const animate = onHome && !pending;

  return { ready: true, animate };
}
