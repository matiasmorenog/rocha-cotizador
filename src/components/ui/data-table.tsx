"use client";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

const SCROLL_STEP_RATIO = 0.8;
const SCROLL_STEP_MIN_PX = 200;
const SCROLL_STEP_MAX_PX = 320;
const EDGE_TOLERANCE_PX = 4;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollStepPx(viewportWidth: number): number {
  return Math.min(
    SCROLL_STEP_MAX_PX,
    Math.max(SCROLL_STEP_MIN_PX, viewportWidth * SCROLL_STEP_RATIO),
  );
}

/**
 * Vertical offset (px from `containerRef`'s own top edge) of the middle of
 * whichever slice of the container currently overlaps the viewport.
 * Clamped to `[0, container height]`, so it lands on the container's own
 * midpoint for tables shorter than the viewport and never drifts past
 * either end while the table is scrolled partway into view.
 *
 * Why not plain `position: sticky; top: 50%`? The chevrons live outside
 * `.data-table-scroll` (so the overflow-x div isn't the containing block
 * here), but percentage insets on a sticky element resolve against its
 * *containing block* height — i.e. the full (tall) table again — not the
 * viewport. That reproduces the exact bug this fixes. Tracking the real
 * viewport/table intersection via `getBoundingClientRect` sidesteps the
 * ambiguity entirely.
 */
function useMidViewportOffset(
  containerRef: RefObject<HTMLDivElement | null>,
): number | null {
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, viewportHeight);
      const mid = (visibleTop + visibleBottom) / 2 - rect.top;
      setOffset(Math.max(0, Math.min(rect.height, mid)));
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      ro.observe(container);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
    };
  }, [containerRef]);

  return offset;
}

/**
 * Horizontal scroll wrapper for wide data tables — mobile, and desktop
 * trackpad-less Windows laptops that have no easy shift-scroll/two-finger
 * gesture. Frame classes live on the same node as overflow-x so
 * border-radius clips thead.
 *
 * Floating chevrons render only while the table overflows and each one
 * hides once its edge is reached; they track the middle of the *visible*
 * slice of the table (see `useMidViewportOffset`), not the full table
 * height, so they stay roughly mid-screen instead of requiring a scroll
 * to the table's midpoint on long tables. Inset from the left/right edges
 * so they sit clear of row action buttons in `<tbody>`.
 */
export function DataTableScroll({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const midOffset = useMidViewportOffset(containerRef);
  const chevronStyle = {
    top: midOffset != null ? `${midOffset}px` : "50%",
  };

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > EDGE_TOLERANCE_PX);
    setCanScrollRight(el.scrollLeft < maxScroll - EDGE_TOLERANCE_PX);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();

    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateEdges);
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    }

    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
      ro?.disconnect();
    };
  }, [updateEdges]);

  const scrollByStep = useCallback((direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * scrollStepPx(el.clientWidth),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div
        id={id}
        ref={scrollRef}
        className={cn(
          "data-table-scroll rounded-lg border border-neutral-200 bg-white shadow-sm",
          className,
        )}
      >
        {children}
      </div>
      {canScrollLeft ? (
        <button
          type="button"
          aria-label="Desplazar tabla a la izquierda"
          onClick={() => scrollByStep(-1)}
          style={chevronStyle}
          className={cn(
            "data-table-scroll-btn absolute left-2 z-10 -translate-y-1/2",
            FOCUS_BRAND_OUTLINE,
          )}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          aria-label="Desplazar tabla a la derecha"
          onClick={() => scrollByStep(1)}
          style={chevronStyle}
          className={cn(
            "data-table-scroll-btn absolute right-2 z-10 -translate-y-1/2",
            FOCUS_BRAND_OUTLINE,
          )}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
