"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { QUOTE_DRAFT_ROW_MOTION_MS } from "@/components/quote/use-animated-draft-lines";

type QuoteDraftAnimatedRowProps = {
  exiting: boolean;
  /** Fade/slide only — skip 0fr cell-close (last row → empty). */
  softExit?: boolean;
  animateEnter: boolean;
  onExitComplete: () => void;
  onEnterComplete?: () => void;
  className?: string;
  children: ReactNode;
};

type CellProps = {
  className?: string;
  children?: ReactNode;
};

function wrapCell(child: ReactNode): ReactNode {
  if (!isValidElement<CellProps>(child)) return child;

  const el = child as ReactElement<CellProps>;
  return cloneElement(el, {
    className: cn(el.props.className, "quote-draft-row-td"),
    children: (
      <div className="quote-draft-row-cell-shell">
        <div className="quote-draft-row-cell-clip">
          <div className="quote-draft-row-cell-pad">{el.props.children}</div>
        </div>
      </div>
    ),
  });
}

export function QuoteDraftAnimatedRow({
  exiting,
  softExit = false,
  animateEnter,
  onExitComplete,
  onEnterComplete,
  className,
  children,
}: QuoteDraftAnimatedRowProps) {
  const onExitCompleteRef = useRef(onExitComplete);
  const onEnterCompleteRef = useRef(onEnterComplete);
  const enterDoneRef = useRef(false);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    onEnterCompleteRef.current = onEnterComplete;
  }, [onEnterComplete]);

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

  useEffect(() => {
    if (!animateEnter) {
      enterDoneRef.current = false;
      return;
    }

    enterDoneRef.current = false;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onEnterCompleteRef.current?.();
      return;
    }

    const t = window.setTimeout(() => {
      if (enterDoneRef.current) return;
      enterDoneRef.current = true;
      onEnterCompleteRef.current?.();
    }, QUOTE_DRAFT_ROW_MOTION_MS + 40);
    return () => window.clearTimeout(t);
  }, [animateEnter]);

  return (
    <tr
      className={cn(
        className,
        animateEnter && "quote-draft-row-enter",
        exiting && (softExit ? "quote-draft-row-exit-soft" : "quote-draft-row-exit"),
        exiting && "pointer-events-none",
      )}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (exiting) {
          onExitCompleteRef.current();
          return;
        }
        if (animateEnter && !enterDoneRef.current) {
          enterDoneRef.current = true;
          onEnterCompleteRef.current?.();
        }
      }}
      aria-hidden={exiting || undefined}
    >
      {Children.map(children, wrapCell)}
    </tr>
  );
}
