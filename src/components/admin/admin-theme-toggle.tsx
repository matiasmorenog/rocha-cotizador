"use client";

import { Moon, Sun } from "lucide-react";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { toggleAdminTheme, useAdminThemeStore } from "@/lib/admin-theme-store";
import { cn } from "@/lib/utils";

export function AdminThemeToggle({ className }: { className?: string }) {
  const theme = useAdminThemeStore();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleAdminTheme}
      aria-label={isDark ? "Modo claro" : "Modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800",
        FOCUS_BRAND_OUTLINE,
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
