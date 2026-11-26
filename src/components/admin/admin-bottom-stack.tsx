"use client";

/** Shared admin bottom-right column for draft chips + in-app toasts. */
export const ADMIN_BOTTOM_STACK_ID = "rocha-admin-bottom-stack";

/**
 * Fixed bottom-right stack. Children portal in; use `order-1` for draft chips
 * and `order-2` for toasts so toasts sit on the bottom edge and push chips up.
 */
export function AdminBottomStackHost() {
  return (
    <div
      id={ADMIN_BOTTOM_STACK_ID}
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
    />
  );
}

export function getAdminBottomStackEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(ADMIN_BOTTOM_STACK_ID);
}
