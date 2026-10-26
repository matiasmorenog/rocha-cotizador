"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

/**
 * Shared admin create-draft modal shell (stock recount pattern): portal overlay,
 * minimize via backdrop / Escape (caller), floating chip while minimized.
 */
export function AdminDraftModal({
  open,
  showShell,
  showChip,
  exiting,
  animKey,
  labelledBy,
  onMinimize,
  onResume,
  maxWidthClassName = "max-w-3xl",
  children,
  chip,
}: {
  open: boolean;
  showShell: boolean;
  showChip: boolean;
  exiting: boolean;
  animKey: string | number;
  labelledBy: string;
  onMinimize: () => void;
  onResume: () => void;
  maxWidthClassName?: string;
  children: ReactNode;
  chip?: {
    title: string;
    subtitle?: string;
    icon: LucideIcon;
  } | null;
}) {
  if (typeof document === "undefined") return null;

  return (
    <>
      {showShell
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4",
                !open && "pointer-events-none invisible",
              )}
              aria-hidden={!open}
            >
              <button
                type="button"
                className={cn(
                  "absolute inset-0 bg-black/40 transition-opacity duration-200",
                  exiting || !open ? "opacity-0" : "opacity-100",
                )}
                aria-label="Minimizar"
                onClick={onMinimize}
                tabIndex={open ? 0 : -1}
              />
              <div
                key={animKey}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                className={cn(
                  "relative z-[1] flex w-full flex-col overflow-hidden rounded-t-lg border border-neutral-200 bg-white shadow-lg sm:rounded-lg",
                  maxWidthClassName,
                  exiting ? "payment-form-exit" : "payment-form-enter",
                )}
              >
                {children}
              </div>
            </div>,
            document.body,
          )
        : null}

      {showChip && chip
        ? createPortal(
            <button
              type="button"
              onClick={onResume}
              className={cn(
                "fixed bottom-4 right-4 z-[95] flex max-w-[min(100vw-2rem,20rem)] items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm shadow-lg",
                FOCUS_BRAND_BORDER,
              )}
            >
              <chip.icon
                className="h-4 w-4 shrink-0 text-[var(--brand-primary)]"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block font-medium text-neutral-900">
                  {chip.title}
                </span>
                {chip.subtitle ? (
                  <span className="block truncate text-xs text-neutral-500">
                    {chip.subtitle}
                  </span>
                ) : null}
              </span>
            </button>,
            document.body,
          )
        : null}
    </>
  );
}

export function AdminDraftModalHeader({
  titleId,
  title,
  description,
}: {
  titleId: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="shrink-0 border-b border-neutral-200 px-4 py-3 sm:px-5">
      <h2
        id={titleId}
        className="text-lg font-semibold text-neutral-900"
      >
        {title}
      </h2>
      {description ? (
        <p className="text-sm text-neutral-600">{description}</p>
      ) : null}
    </div>
  );
}

export function AdminDraftModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminDraftModalFooter({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-neutral-200 px-4 py-3 sm:px-5">
      {children}
    </div>
  );
}

export function AdminDraftTrigger({
  onClick,
  pending = false,
  idleLabel,
  pendingLabel,
  icon: Icon,
}: {
  onClick: () => void;
  pending?: boolean;
  /** Ignored — dirty state is a dot, not a count (call sites may still pass it). */
  itemCount?: number;
  idleLabel: string;
  pendingLabel: string;
  icon: LucideIcon;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={pending ? `${pendingLabel} (borrador pendiente)` : idleLabel}
    >
      <Icon className="mr-1.5 h-4 w-4" aria-hidden />
      {pending ? pendingLabel : idleLabel}
      {pending ? (
        <span
          className="ml-2 size-2 shrink-0 rounded-full bg-current opacity-90"
          aria-hidden
        />
      ) : null}
    </Button>
  );
}
