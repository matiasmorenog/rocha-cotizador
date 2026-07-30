"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { QUOTE_DRAFT_ROW_MOTION_MS } from "@/components/quote/use-animated-draft-lines";

type QuoteDraftEmptyRowProps = {
  exiting: boolean;
  onExitComplete: () => void;
};

/** Empty placeholder — exits with same fade/height motion as product rows. */
export function QuoteDraftEmptyRow({
  exiting,
  onExitComplete,
}: QuoteDraftEmptyRowProps) {
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
      className={cn(exiting && "quote-draft-row-exit pointer-events-none")}
      onAnimationEnd={(e) => {
        if (!exiting) return;
        if (e.target !== e.currentTarget) return;
        onExitCompleteRef.current();
      }}
      aria-hidden={exiting || undefined}
    >
      <td colSpan={7} className="quote-draft-row-td text-center text-neutral-500">
        <div className="quote-draft-row-cell-shell">
          <div className="quote-draft-row-cell-clip">
            <div className="px-3 py-8">Sin productos. Buscá y agregá líneas.</div>
          </div>
        </div>
      </td>
    </tr>
  );
}
