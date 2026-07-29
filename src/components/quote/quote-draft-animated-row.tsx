"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { QUOTE_DRAFT_ROW_MOTION_MS } from "@/components/quote/use-animated-draft-lines";

type QuoteDraftAnimatedRowProps = {
  exiting: boolean;
  animateEnter: boolean;
  onExitComplete: () => void;
  className?: string;
  children: ReactNode;
};

export function QuoteDraftAnimatedRow({
  exiting,
  animateEnter,
  onExitComplete,
  className,
  children,
}: QuoteDraftAnimatedRowProps) {
  const onExitCompleteRef = useRef(onExitComplete);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    if (!exiting) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onExitCompleteRef.current();
      return;
    }

    const t = window.setTimeout(
      () => onExitCompleteRef.current(),
      QUOTE_DRAFT_ROW_MOTION_MS + 40,
    );
    return () => window.clearTimeout(t);
  }, [exiting]);

  return (
    <tr
      className={cn(
        className,
        animateEnter && "quote-draft-row-enter",
        exiting && "quote-draft-row-exit",
        exiting && "pointer-events-none",
      )}
      onAnimationEnd={(e) => {
        if (!exiting) return;
        if (e.target !== e.currentTarget) return;
        onExitCompleteRef.current();
      }}
      aria-hidden={exiting || undefined}
    >
      {children}
    </tr>
  );
}
