"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type Props = {
  value: number;
  durationMs?: number;
  delayMs?: number;
  className?: string;
  format?: (n: number) => string;
};

/**
 * Integer count-up for KPI-style numbers. No prior Rocha pattern —
 * light rAF tween; static when `prefers-reduced-motion`.
 */
export function AnimatedCount({
  value,
  durationMs = 650,
  delayMs = 0,
  className,
  format = (n) => n.toLocaleString("es-AR"),
}: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const target = Number.isFinite(value) ? Math.round(value) : 0;

  if (reduceMotion) {
    return (
      <span className={cn("tabular-nums", className)}>{format(target)}</span>
    );
  }

  return (
    <AnimatedCountMotion
      key={target}
      target={target}
      durationMs={durationMs}
      delayMs={delayMs}
      className={className}
      format={format}
    />
  );
}

function AnimatedCountMotion({
  target,
  durationMs,
  delayMs,
  className,
  format,
}: {
  target: number;
  durationMs: number;
  delayMs: number;
  className?: string;
  format: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    let startTs: number | null = null;
    const from = 0;

    const timeout = window.setTimeout(() => {
      const tick = (now: number) => {
        if (startTs == null) startTs = now;
        const t = Math.min(1, (now - startTs) / durationMs);
        setDisplay(Math.round(from + (target - from) * easeOutCubic(t)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, delayMs]);

  return (
    <span className={cn("tabular-nums", className)}>{format(display)}</span>
  );
}
