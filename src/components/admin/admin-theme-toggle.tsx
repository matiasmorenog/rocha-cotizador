"use client";

import { Moon, Sun } from "lucide-react";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";
import { useAdminTheme } from "@/components/admin/admin-theme-provider";

export function AdminThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useAdminTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Modo claro" : "Modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900",
        FOCUS_BRAND_OUTLINE,
        className,
      )}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 shrink-0" aria-hidden />
          <span>Modo claro</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 shrink-0" aria-hidden />
          <span>Modo oscuro</span>
        </>
      )}
    </button>
  );
}
