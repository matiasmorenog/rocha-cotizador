"use client";

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

/**
 * Compact toast stack (bottom-right). Brand: bordo / latte.
 * Click body opens url; X dismisses.
 */
export function AdminNotificationToasts({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col-reverse gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`admin-toast-enter pointer-events-auto overflow-hidden rounded-lg border border-[var(--brand-latte)] border-l-4 bg-[var(--brand-primary-soft)] shadow-lg ${toneAccent[toast.tone]}`}
        >
          <div className="flex items-start gap-2 p-3">
            <a
              href={toast.url}
              className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
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
                Abrir · aviso en la app
              </p>
            </a>
            <button
              type="button"
              aria-label="Cerrar aviso"
              className="shrink-0 rounded-md px-1.5 py-0.5 text-sm leading-none text-[var(--foreground)]/55 transition-colors hover:bg-white/70 hover:text-[var(--foreground)]"
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
