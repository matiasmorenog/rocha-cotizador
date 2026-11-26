"use client";

import { usePathname } from "next/navigation";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouteLoading } from "@/lib/route-loading-context";

/**
 * Fade/slide enter when a route settles after soft nav / first load.
 *
 * `.route-view-enter` uses fill-mode `both` and only runs once per element.
 * If the class sticks on a long-lived wrapper while Next swaps `loading.tsx`
 * → page (or while pending cover hides the node), the animation burns on the
 * skeleton and real content pops in with no entrance.
 *
 * Gate while `pending`, then mount a fresh animated node on each reveal.
 */
export function RouteViewEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { pending } = useRouteLoading();
  const [enterKey, setEnterKey] = useState(0);
  const wasPendingRef = useRef(true);

  useLayoutEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }
    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      setEnterKey((key) => key + 1);
    }
  }, [pending, pathname]);

  const gated = pending || enterKey === 0;

  return (
    <div className="min-w-0">
      {gated ? (
        <div
          className="pointer-events-none opacity-0"
          aria-hidden
          {...{ inert: true }}
        >
          {children}
        </div>
      ) : (
        <div key={`${pathname}-${enterKey}`} className="route-view-enter">
          {children}
        </div>
      )}
    </div>
  );
}
