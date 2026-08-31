"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import Link from "next/link";
import { FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

type HorizontalIndicator = { axis: "horizontal"; left: number; width: number };
type VerticalIndicator = { axis: "vertical"; top: number; height: number };
type IndicatorState = HorizontalIndicator | VerticalIndicator;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function measureHorizontalIndicator(
  list: HTMLElement,
  itemSelector: string,
): HorizontalIndicator | null {
  const active = list.querySelector<HTMLElement>(itemSelector);
  if (!active) return null;
  return {
    axis: "horizontal",
    left: active.offsetLeft,
    width: active.offsetWidth,
  };
}

function measureVerticalIndicator(
  list: HTMLElement,
  itemSelector: string,
): VerticalIndicator | null {
  const active = list.querySelector<HTMLElement>(itemSelector);
  if (!active) return null;
  return {
    axis: "vertical",
    top: active.offsetTop,
    height: active.offsetHeight,
  };
}

function useSlidingIndicator(
  activeKey: string,
  orientation: "horizontal" | "vertical",
  itemSelector: string,
) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<IndicatorState | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const update = () => {
      const next =
        orientation === "horizontal"
          ? measureHorizontalIndicator(list, itemSelector)
          : measureVerticalIndicator(list, itemSelector);
      if (next) setIndicator(next);
    };

    update();
    setAnimate(!prefersReducedMotion());

    const ro = new ResizeObserver(update);
    ro.observe(list);
    for (const child of list.querySelectorAll(":scope > *")) {
      ro.observe(child);
    }

    return () => ro.disconnect();
  }, [activeKey, orientation, itemSelector]);

  return { listRef, indicator, animate };
}

function SlidingIndicator({
  indicator,
  animate,
}: {
  indicator: IndicatorState;
  animate: boolean;
}) {
  const animateClass = animate && "solapas-tab-indicator-animate";

  if (indicator.axis === "horizontal") {
    return (
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 bottom-1 left-0 z-0 rounded-md bg-[var(--brand-primary-soft)]",
          animateClass,
        )}
        style={{
          width: indicator.width,
          transform: `translateX(${indicator.left}px)`,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "admin-nav-indicator pointer-events-none absolute right-0 left-0 z-0 rounded-md bg-[var(--brand-primary-soft)]",
        animateClass,
      )}
      style={{
        height: indicator.height,
        transform: `translateY(${indicator.top}px)`,
      }}
    />
  );
}

type SolapasTabListProps = {
  children: ReactNode;
  className?: string;
  /** Re-measure sliding indicator when active tab changes. */
  activeKey: string;
  "aria-label": string;
  size?: "sm" | "md";
};

/** Segmented pill tab bar (previous visual style) with sliding active indicator. */
export function SolapasTabList({
  children,
  className,
  activeKey,
  "aria-label": ariaLabel,
  size = "md",
}: SolapasTabListProps) {
  const { listRef, indicator, animate } = useSlidingIndicator(
    activeKey,
    "horizontal",
    '[aria-selected="true"]',
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex gap-1 rounded-lg border border-neutral-200 p-1",
        size === "sm" ? "bg-neutral-50" : "bg-white",
        className,
      )}
    >
      {indicator ? (
        <SlidingIndicator indicator={indicator} animate={animate} />
      ) : null}
      {children}
    </div>
  );
}

type SolapasNavListProps = {
  children: ReactNode;
  className?: string;
  /** Re-measure when route changes (e.g. pathname). */
  activeKey: string;
  "aria-label": string;
};

/** Vertical nav list with sliding active indicator (admin sidebar). */
export function SolapasNavList({
  children,
  className,
  activeKey,
  "aria-label": ariaLabel,
}: SolapasNavListProps) {
  const { listRef, indicator, animate } = useSlidingIndicator(
    activeKey,
    "vertical",
    '[aria-current="page"]',
  );

  return (
    <nav
      ref={listRef}
      aria-label={ariaLabel}
      className={cn("relative flex flex-col gap-1 text-sm", className)}
    >
      {indicator ? (
        <SlidingIndicator indicator={indicator} animate={animate} />
      ) : null}
      {children}
    </nav>
  );
}

const tabTriggerClass = (selected: boolean, size: "sm" | "md") =>
  cn(
    "relative z-[1] rounded-md font-medium transition-colors duration-200",
    FOCUS_BRAND_OUTLINE,
    size === "sm"
      ? "px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm"
      : "px-4 py-2 text-sm",
    selected
      ? "text-[var(--brand-primary)]"
      : size === "sm"
        ? "text-neutral-600 hover:bg-white/70 hover:text-neutral-900"
        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
  );

type SolapasTabLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  selected: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function SolapasTabLink({
  selected,
  className,
  size = "md",
  ...rest
}: SolapasTabLinkProps) {
  return (
    <Link
      role="tab"
      aria-selected={selected}
      className={cn(tabTriggerClass(selected, size), className)}
      {...rest}
    />
  );
}

type SolapasNavLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  active: boolean;
  className?: string;
};

export function SolapasNavLink({
  active,
  className,
  ...rest
}: SolapasNavLinkProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "admin-nav-link relative z-[1] inline-flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-200",
        FOCUS_BRAND_OUTLINE,
        active
          ? "admin-nav-link-active font-medium text-[var(--brand-primary)]"
          : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900",
        className,
      )}
      {...rest}
    />
  );
}

type SolapasTabButtonProps = ComponentProps<"button"> & {
  selected: boolean;
  size?: "sm" | "md";
};

export function SolapasTabButton({
  selected,
  size = "md",
  className,
  type = "button",
  ...rest
}: SolapasTabButtonProps) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={selected}
      className={cn(tabTriggerClass(selected, size), className)}
      {...rest}
    />
  );
}

/** Fade/slide panel body on tab key change (respects reduced motion). */
export function SolapasTabContent({
  tabKey,
  children,
  className,
}: {
  tabKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div key={tabKey} className={cn("solapas-tab-content-enter", className)}>
      {children}
    </div>
  );
}
