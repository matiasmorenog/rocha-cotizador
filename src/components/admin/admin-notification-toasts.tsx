"use client";

import { useEffect, useRef, useState } from "react";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export type AdminToastTone = "info" | "success" | "warning" | "error";

export type AdminToastItem = {
  id: string;
  title: string;
  body: string;
  /** When absent, toast is informational only (no navigation). */
  url?: string;
  tone: AdminToastTone;
  source: "inbox" | "push" | "test" | "subscription";
  /** Stay until user closes — no auto TTL. */
  sticky?: boolean;
  /** Show even when in-app notifications pref is off. */
  forceShow?: boolean;
};

type Props = {
  toasts: AdminToastItem[];
  onDismiss: (id: string) => void;
};

const toneShell: Record<
  AdminToastTone,
  { box: string; title: string; hoverClose: string }
> = {
  info: {
    box: "border-[var(--brand-primary)]/20 border-l-[var(--brand-primary)] bg-[var(--brand-primary-soft)]",
    title: "text-[var(--brand-primary)]",
    hoverClose: "hover:bg-[var(--brand-primary-soft)]",
  },
  success: {
    box: "border-emerald-700/20 border-l-emerald-700 bg-emerald-50",
    title: "text-emerald-800",
    hoverClose: "hover:bg-emerald-100",
  },
  warning: {
    box: "border-amber-700/25 border-l-amber-600 bg-amber-50",
    title: "text-amber-950",
    hoverClose: "hover:bg-amber-100",
  },
  error: {
    box: "border-red-700/20 border-l-red-700 bg-red-50",
    title: "text-red-800",
    hoverClose: "hover:bg-red-100",
  },
};

/** Keep in sync with `.admin-toast-exit` duration in globals.css. */
const TOAST_EXIT_MS = 280;

type DisplayItem = { toast: AdminToastItem; exiting: boolean };

/**
 * Compact toast stack (bottom-right).
 * Click body opens url when present; X dismisses.
 *
 * Keeps toasts mounted for `TOAST_EXIT_MS` after they leave `toasts` so the
 * exit animation can play instead of popping out of the DOM instantly.
 */
export function AdminNotificationToasts({ toasts, onDismiss }: Props) {
  const [items, setItems] = useState<DisplayItem[]>(() =>
    toasts.map((toast) => ({ toast, exiting: false })),
  );
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const timers = exitTimersRef.current;
    setItems((prev) => {
      const kept = prev.map((item) => {
        if (item.exiting) return item;
        const fresh = toasts.find((t) => t.id === item.toast.id);
        if (fresh) {
          return fresh === item.toast ? item : { toast: fresh, exiting: false };
        }

        const id = item.toast.id;
        const timer = setTimeout(() => {
          setItems((cur) => cur.filter((x) => x.toast.id !== id));
          timers.delete(id);
        }, TOAST_EXIT_MS);
        timers.set(id, timer);
        return { toast: item.toast, exiting: true };
      });
      const knownIds = new Set(kept.map((item) => item.toast.id));
      const added = toasts
        .filter((t) => !knownIds.has(t.id))
        .map((toast) => ({ toast, exiting: false }));
      return [...kept, ...added];
    });
  }, [toasts]);

  // Clear pending exit timers on unmount only.
  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col-reverse gap-2"
    >
      {items.map(({ toast, exiting }) => {
        const shell = toneShell[toast.tone];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "admin-notification-toast pointer-events-auto overflow-hidden rounded-lg border border-l-4 shadow-sm",
              shell.box,
              exiting ? "admin-toast-exit" : "admin-toast-enter",
            )}
          >
            <div className="flex items-start gap-2 p-3">
              {toast.url ? (
                <a
                  href={toast.url}
                  className={cn("min-w-0 flex-1 rounded-sm", FOCUS_BRAND_OUTLINE)}
                  onClick={() => onDismiss(toast.id)}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      shell.title,
                    )}
                  >
                    {toast.title}
                  </p>
                  {toast.body ? (
                    <p className="mt-0.5 text-xs leading-snug text-[var(--foreground)]/80">
                      {toast.body}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--foreground)]/50">
                    Abrir · notificación en la app
                  </p>
                </a>
              ) : (
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      shell.title,
                    )}
                  >
                    {toast.title}
                  </p>
                  {toast.body ? (
                    <p className="mt-0.5 text-xs leading-snug text-[var(--foreground)]/80">
                      {toast.body}
                    </p>
                  ) : null}
                </div>
              )}
              <button
                type="button"
                aria-label="Cerrar notificación"
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-sm leading-none text-[var(--foreground)]/55 transition-colors hover:text-[var(--foreground)]",
                  shell.hoverClose,
                )}
                onClick={() => onDismiss(toast.id)}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
