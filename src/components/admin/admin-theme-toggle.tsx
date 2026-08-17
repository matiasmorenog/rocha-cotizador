"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { playAdminThemeDropSound } from "@/lib/admin-theme-hint-sound";
import { toggleAdminTheme, useAdminThemeStore } from "@/lib/admin-theme-store";
import { cn } from "@/lib/utils";

const THEME_HINT_SEEN_KEY = "rocha-admin-theme-hint-seen";

const LIGHT_HINT = "Descansá la vista con el modo oscuro";
const DARK_HINT = "Modo oscuro activo — volvé al claro cuando quieras";

type TipPos = { left: number; top: number; place: "below" | "above" };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AdminThemeToggle({ className }: { className?: string }) {
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const theme = useAdminThemeStore();
  const isDark = theme === "dark";
  const [tip, setTip] = useState<TipPos | null>(null);
  const hintText = isDark ? DARK_HINT : LIGHT_HINT;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const positionTip = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const tipMaxW = 240;
    const pad = 8;
    let left = rect.left + rect.width / 2 - tipMaxW / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tipMaxW - pad));
    const spaceBelow = window.innerHeight - rect.bottom;
    const place: TipPos["place"] = spaceBelow < 56 ? "above" : "below";
    const top = place === "below" ? rect.bottom + 6 : rect.top - 6;
    setTip({ left, top, place });
  }, []);

  const showTip = useCallback(
    (playSound: boolean) => {
      const el = buttonRef.current;
      if (!el) return;
      clearHideTimer();
      positionTip(el);
      if (playSound) playAdminThemeDropSound();
    },
    [clearHideTimer, positionTip],
  );

  const hideTip = useCallback(() => {
    clearHideTimer();
    setTip(null);
  }, [clearHideTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;
    try {
      if (localStorage.getItem(THEME_HINT_SEEN_KEY)) return;
      localStorage.setItem(THEME_HINT_SEEN_KEY, "1");
    } catch {
      return;
    }

    const el = buttonRef.current;
    if (!el) return;

    const timer = window.setTimeout(() => {
      showTip(true);
      hideTimerRef.current = window.setTimeout(() => {
        setTip(null);
        hideTimerRef.current = null;
      }, 3200);
    }, 600);

    return () => {
      window.clearTimeout(timer);
      clearHideTimer();
    };
  }, [clearHideTimer, showTip]);

  useEffect(() => {
    if (!tip) return;
    const onScrollOrResize = () => {
      const el = buttonRef.current;
      if (el) positionTip(el);
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [tip, positionTip]);

  const handleToggle = () => {
    const goingDark = !isDark;
    toggleAdminTheme();
    if (goingDark) playAdminThemeDropSound();
    hideTip();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
        aria-describedby={tip ? tipId : undefined}
        onMouseEnter={() => showTip(true)}
        onMouseLeave={hideTip}
        onFocus={() => showTip(false)}
        onBlur={hideTip}
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
      {tip
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="admin-theme-hint-tooltip pointer-events-none fixed z-[200] w-max max-w-[15rem] rounded-md border border-[var(--brand-primary)]/25 bg-[var(--brand-primary-soft)] px-2.5 py-1.5 text-center text-xs leading-snug text-[var(--brand-primary)] shadow-md print:hidden"
              style={{
                left: tip.left,
                top: tip.top,
                transform:
                  tip.place === "above" ? "translateY(-100%)" : undefined,
              }}
            >
              {hintText}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
