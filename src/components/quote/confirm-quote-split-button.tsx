"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDown } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FOCUS_BRAND_PRIMARY } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";
import {
  CONFIRM_QUOTE_ACTION_KEY,
  confirmQuoteActionLabel,
  readConfirmQuoteAction,
  saveConfirmQuoteAction,
  type ConfirmQuoteAction,
} from "@/lib/confirm-quote-action";

export type { ConfirmQuoteAction };

function subscribeConfirmAction(onStoreChange: () => void) {
  function onStorage(e: StorageEvent) {
    if (e.key === CONFIRM_QUOTE_ACTION_KEY || e.key === null) onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener("rocha:confirm-quote-action", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("rocha:confirm-quote-action", onStoreChange);
  };
}

function getConfirmActionSnapshot(): ConfirmQuoteAction {
  return readConfirmQuoteAction();
}

function getServerSnapshot(): ConfirmQuoteAction {
  return "view";
}

type Props = {
  disabled?: boolean;
  submitting?: boolean;
  onConfirm: (action: ConfirmQuoteAction) => void;
};

/**
 * GitHub-style split primary: main click uses last remembered action;
 * chevron opens menu to switch (and persist) the default.
 */
export function ConfirmQuoteSplitButton({
  disabled = false,
  submitting = false,
  onConfirm,
}: Props) {
  const action = useSyncExternalStore(
    subscribeConfirmAction,
    getConfirmActionSnapshot,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function setAction(next: ConfirmQuoteAction) {
    saveConfirmQuoteAction(next);
    window.dispatchEvent(new Event("rocha:confirm-quote-action"));
    setOpen(false);
  }

  const busy = submitting || disabled;
  const label = confirmQuoteActionLabel(action);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <div className="inline-flex rounded-md shadow-sm">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(action)}
          className={cn(
            "inline-flex h-10 cursor-pointer items-center justify-center bg-[var(--brand-primary)] px-4 text-sm font-medium text-white transition-colors",
            "hover:brightness-95 active:brightness-90",
            FOCUS_BRAND_PRIMARY,
            "focus-visible:relative focus-visible:z-10",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "rounded-l-md rounded-r-none",
          )}
        >
          {submitting ? (
            <>
              <Spinner className="mr-2 text-white" />
              Enviando…
            </>
          ) : (
            label
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label="Opciones al confirmar"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex h-10 w-10 cursor-pointer items-center justify-center border-l border-white/25 bg-[var(--brand-primary)] text-white transition-colors",
            "hover:brightness-95 active:brightness-90",
            FOCUS_BRAND_PRIMARY,
            "focus-visible:relative focus-visible:z-10",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "rounded-r-md rounded-l-none",
          )}
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-label="Acción al confirmar"
          className="absolute right-0 bottom-full z-50 mb-1 min-w-[16rem] overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {(
            [
              ["view", "Confirmar y ver remito"],
              ["new", "Confirmar y crear nuevo remito"],
            ] as const
          ).map(([value, text]) => (
            <li key={value} role="presentation">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={action === value}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-50",
                  action === value && "bg-[var(--brand-primary-soft)] font-medium",
                )}
                onClick={() => setAction(value)}
              >
                <span
                  className={cn(
                    "inline-block h-2 w-2 shrink-0 rounded-full border border-neutral-400",
                    action === value &&
                      "border-[var(--brand-primary)] bg-[var(--brand-primary)]",
                  )}
                  aria-hidden
                />
                {text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
