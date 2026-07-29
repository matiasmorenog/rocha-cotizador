"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useQuoteDraftStore,
  type QuoteDraftLine,
} from "@/stores/quote-draft-store";

/** Keep in sync with `.quote-draft-row-exit` duration in globals.css */
export const QUOTE_DRAFT_ROW_MOTION_MS = 180;

export type AnimatedDraftRow = {
  line: QuoteDraftLine;
  exiting: boolean;
  animateEnter: boolean;
};

/**
 * Keeps removed draft lines in the list long enough to play exit motion.
 * Skips enter animation for the post-hydration snapshot (persisted draft).
 */
export function useAnimatedDraftLines(
  lines: QuoteDraftLine[],
): {
  rows: AnimatedDraftRow[];
  completeExit: (lineId: string) => void;
} {
  const [rows, setRows] = useState<AnimatedDraftRow[]>(() =>
    lines.map((line) => ({ line, exiting: false, animateEnter: false })),
  );
  const enterEnabledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const enableEnterAfterHydration = () => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const latest = useQuoteDraftStore.getState().lines;
        setRows(
          latest.map((line) => ({
            line,
            exiting: false,
            animateEnter: false,
          })),
        );
        enterEnabledRef.current = true;
      });
    };

    if (useQuoteDraftStore.persist.hasHydrated()) {
      enableEnterAfterHydration();
      return () => {
        cancelled = true;
      };
    }

    const unsub = useQuoteDraftStore.persist.onFinishHydration(() => {
      enableEnterAfterHydration();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!enterEnabledRef.current) {
      setRows(
        lines.map((line) => ({ line, exiting: false, animateEnter: false })),
      );
      return;
    }

    setRows((prev) => {
      const nextById = new Map(lines.map((l) => [l.id, l]));
      const result: AnimatedDraftRow[] = [];
      const present = new Set<string>();

      for (const row of prev) {
        const updated = nextById.get(row.line.id);
        if (updated) {
          result.push({
            line: updated,
            exiting: false,
            animateEnter: false,
          });
          present.add(row.line.id);
        } else if (row.exiting) {
          result.push(row);
          present.add(row.line.id);
        } else {
          result.push({
            line: row.line,
            exiting: true,
            animateEnter: false,
          });
          present.add(row.line.id);
        }
      }

      for (const line of lines) {
        if (!present.has(line.id)) {
          result.push({ line, exiting: false, animateEnter: true });
        }
      }

      return result;
    });
  }, [lines]);

  const completeExit = useCallback((lineId: string) => {
    setRows((prev) =>
      prev.filter((row) => !(row.line.id === lineId && row.exiting)),
    );
  }, []);

  return { rows, completeExit };
}
