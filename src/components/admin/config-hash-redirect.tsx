"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isConfigTab } from "@/lib/admin-config-tabs";

/** Legacy `#cuenta` (and other hash anchors) → `?tab=`. */
export function ConfigHashRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab")) return;
    const hash = window.location.hash.slice(1);
    if (!hash || !isConfigTab(hash)) return;
    router.replace(`/admin/configuracion?tab=${hash}`);
  }, [router, searchParams]);

  return null;
}
