"use client";

import { useCallback, useEffect, useState } from "react";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { useIsClient } from "@/hooks/use-is-client";

export type DraftSessionInfo = {
  pending: boolean;
  itemCount: number;
};

/**
 * Modal draft session: keep form mounted while minimized; Escape / backdrop
 * minimize; discard ends session. Parent owns field reset on discard.
 */
export function useDraftSession({
  open: openProp,
  onOpenChange,
  itemCount = 0,
  onDraftChange,
  exitMs = 200,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  itemCount?: number;
  onDraftChange?: (draft: DraftSessionInfo) => void;
  exitMs?: number;
}) {
  const isClient = useIsClient();
  const [sessionActive, setSessionActive] = useState(false);
  const [openInternal, setOpenInternal] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? Boolean(openProp) : openInternal;

  const setOpen = useCallback(
    (v: boolean) => {
      if (v) setSessionActive(true);
      if (controlled) onOpenChange?.(v);
      else setOpenInternal(v);
    },
    [controlled, onOpenChange],
  );

  // Controlled parent may open without going through setOpen.
  if (open && !sessionActive) {
    setSessionActive(true);
  }

  const draftPending = sessionActive;

  useEffect(() => {
    onDraftChange?.({ pending: draftPending, itemCount });
    return () => {
      onDraftChange?.({ pending: false, itemCount: 0 });
    };
  }, [draftPending, itemCount, onDraftChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const minimize = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        minimize();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, minimize]);

  const { present, exiting, animKey } = useExitPresence(open, exitMs);
  const showShell = isClient && (sessionActive || present);
  const showChip = isClient && sessionActive && !open;

  return {
    open,
    setOpen,
    sessionActive,
    minimize,
    endSession,
    showShell,
    showChip,
    present,
    exiting,
    animKey,
  };
}
