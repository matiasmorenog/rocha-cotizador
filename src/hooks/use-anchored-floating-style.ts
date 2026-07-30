"use client";

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

/**
 * Fixed position under an anchor — for listboxes portaled to document.body
 * so ancestors with overflow/transform cannot clip or trap stacking.
 */
export function useAnchoredFloatingStyle(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  gapPx = 4,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>();

  useLayoutEffect(() => {
    if (!open) return;

    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setStyle({
        position: "fixed",
        top: r.bottom + gapPx,
        left: r.left,
        width: r.width,
        zIndex: 50,
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, open, gapPx]);

  return open ? style : undefined;
}
