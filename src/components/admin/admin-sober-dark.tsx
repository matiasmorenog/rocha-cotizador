"use client";

import { useLayoutEffect } from "react";

const SOBER_DARK_ATTR = "data-admin-sober-dark";

/** Flat admin dark experiment: no glow, border-only elevation on all protected /admin/* routes. */
export function AdminSoberDark() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute(SOBER_DARK_ATTR, "");
    return () => root.removeAttribute(SOBER_DARK_ATTR);
  }, []);

  return null;
}
