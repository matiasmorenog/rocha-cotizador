"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Keep in sync with toast/chip exit + `.admin-bottom-stack-slot` in globals.css */
export const ADMIN_BOTTOM_STACK_SLOT_MS = 280;

/**
 * Collapsing slot for the shared bottom stack — height eases open/closed so
 * siblings slide instead of jumping when a toast or chip leaves.
 */
export function AdminBottomStackSlot({
  exiting = false,
  className,
  children,
}: {
  exiting?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [entered, setEntered] = useState(false);

  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const open = entered && !exiting;

  return (
    <div
      className={cn(
        "admin-bottom-stack-slot grid min-h-0 transition-[grid-template-rows] ease-in-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
      style={{ transitionDuration: `${ADMIN_BOTTOM_STACK_SLOT_MS}ms` }}
    >
      <div className="min-h-0 overflow-hidden">
        {/* mb replaces parent gap so margin collapses with the slot */}
        <div className="mb-2">{children}</div>
      </div>
    </div>
  );
}
