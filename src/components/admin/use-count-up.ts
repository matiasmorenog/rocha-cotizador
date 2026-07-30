"use client";

import { useEffect, useState } from "react";

const MIN_DURATION_MS = 650;
const MAX_DURATION_MS = 1400;

export function easeOutExpo(progress: number) {
  return progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
}

export function getCountDuration(target: number) {
  if (target <= 0) return MIN_DURATION_MS;

  const magnitude = Math.log10(Math.max(target, 1));
  return Math.min(MAX_DURATION_MS, MIN_DURATION_MS + magnitude * 220);
}

type UseCountUpOptions = {
  delay?: number;
  duration?: number;
};

export function useCountUp(
  target: number,
  { delay = 0, duration }: UseCountUpOptions = {},
) {
  const resolvedDuration = duration ?? getCountDuration(target);
  const [displayValue, setDisplayValue] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let frame = 0;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      frame = requestAnimationFrame(() => {
        setDisplayValue(target);
        setIsComplete(true);
      });
      return () => cancelAnimationFrame(frame);
    }

    let startTime: number | null = null;

    const timeout = window.setTimeout(() => {
      setDisplayValue(0);
      frame = requestAnimationFrame(() => {
        setIsComplete(false);
      });

      const step = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;

        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / resolvedDuration, 1);
        const nextValue = Math.round(easeOutExpo(progress) * target);

        setDisplayValue(nextValue);

        if (progress < 1) {
          frame = requestAnimationFrame(step);
          return;
        }

        setDisplayValue(target);
        setIsComplete(true);
      };

      frame = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [target, resolvedDuration, delay]);

  return { displayValue, isComplete };
}
