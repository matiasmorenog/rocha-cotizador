"use client";

import {
  type ReactNode,
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
 * Horizontal scroll wrapper for wide data tables — mobile, and desktop
 * trackpad-less Windows laptops that have no easy shift-scroll/two-finger
 * gesture. Frame classes live on the same node as overflow-x so
 * border-radius clips thead.
 *
 * Floating chevrons render only while the table overflows and each one
 * hides once its edge is reached; they're pinned over the header row
 * (not centered on the full table height) so they never sit on top of
 * row actions in `<tbody>`.
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
    <div className="relative">
      <div
        id={id}
        ref={scrollRef}
        className={cn(
          "data-table-scroll rounded-lg border border-neutral-200 bg-white",
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
          className={cn(
            "data-table-scroll-btn absolute left-1.5 top-2 z-10",
            FOCUS_BRAND_OUTLINE,
          )}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          aria-label="Desplazar tabla a la derecha"
          onClick={() => scrollByStep(1)}
          className={cn(
            "data-table-scroll-btn absolute right-1.5 top-2 z-10",
            FOCUS_BRAND_OUTLINE,
          )}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
