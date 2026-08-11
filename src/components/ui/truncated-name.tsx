"use client";

import { useCallback, useId, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  /** 1 = single-line ellipsis; 2 = two-line clamp. */
  lines?: 1 | 2;
  className?: string;
};

type TipPos = { left: number; top: number; place: "below" | "above" };

/**
 * Truncated product name with a portal hover tooltip.
 * Native `title` is unreliable on `-webkit-line-clamp` / `-webkit-box`
 * (and delayed ~1s); DataTableScroll overflow would also clip in-cell tips.
 */
export function TruncatedName({ name, lines = 2, className }: Props) {
  const tipId = useId();
  const [pos, setPos] = useState<TipPos | null>(null);

  const show = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const tipMaxW = 320;
    const pad = 8;
    let left = rect.left;
    if (left + tipMaxW > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - tipMaxW - pad);
    }
    const spaceBelow = window.innerHeight - rect.bottom;
    const place: TipPos["place"] = spaceBelow < 56 ? "above" : "below";
    const top = place === "below" ? rect.bottom + 4 : rect.top - 4;
    setPos({ left, top, place });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <>
      <div
        className={cn(
          lines === 1 ? "admin-table-name-1l" : "admin-table-name-2l",
          className,
        )}
        aria-describedby={pos ? tipId : undefined}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={hide}
      >
        {name}
      </div>
      {pos
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-[200] max-w-[20rem] rounded-md border border-[color-mix(in_srgb,var(--brand-latte)_65%,transparent)] bg-[var(--brand-primary-soft)] px-2.5 py-1.5 text-xs leading-snug text-[var(--brand-primary)] shadow-md print:hidden"
              style={{
                left: pos.left,
                top: pos.top,
                transform:
                  pos.place === "above" ? "translateY(-100%)" : undefined,
              }}
            >
              {name}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
