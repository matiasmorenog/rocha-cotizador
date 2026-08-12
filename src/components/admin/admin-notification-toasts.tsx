"use client";

import { useEffect, useRef, useState } from "react";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

export type AdminToastTone = "info" | "success" | "error";

export type AdminToastItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  tone: AdminToastTone;
  source: "inbox" | "push" | "test";
};

type Props = {
  toasts: AdminToastItem[];
  onDismiss: (id: string) => void;
};

const toneAccent: Record<AdminToastTone, string> = {
  info: "border-l-[var(--brand-primary)]",
  success: "border-l-emerald-700",
  error: "border-l-red-700",
};

/** Keep in sync with `.admin-toast-exit` duration in globals.css. */
const TOAST_EXIT_MS = 280;

type DisplayItem = { toast: AdminToastItem; exiting: boolean };

/**
 * Compact toast stack (bottom-right). Brand: teal.
 * Click body opens url; X dismisses.
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
      {items.map(({ toast, exiting }) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto overflow-hidden rounded-lg border border-[var(--brand-primary)]/20 border-l-4 bg-[#f7fbfa] shadow-[0_8px_24px_rgba(26,46,44,0.12)]",
            exiting ? "admin-toast-exit" : "admin-toast-enter",
            toneAccent[toast.tone],
          )}
        >
          <div className="flex items-start gap-2 p-3">
            <a
              href={toast.url}
              className={cn("min-w-0 flex-1 rounded-sm", FOCUS_BRAND_OUTLINE)}
              onClick={() => onDismiss(toast.id)}
            >
              <p className="text-sm font-semibold leading-snug text-[var(--brand-primary)]">
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
            <button
              type="button"
              aria-label="Cerrar notificación"
              className="shrink-0 rounded-md px-1.5 py-0.5 text-sm leading-none text-[var(--foreground)]/55 transition-colors hover:bg-[var(--brand-primary-soft)] hover:text-[var(--foreground)]"
              onClick={() => onDismiss(toast.id)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
