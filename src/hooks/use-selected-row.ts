"use client";

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";

/** Props returned by `rowProps(id)` — spread onto a `<tr>`. */
export type RowSelectionProps = {
  "data-selected": "true" | undefined;
  ref: (el: HTMLTableRowElement | null) => void;
  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => void;
};

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True while focus sits inside an editable control (search box, an open
 * edit panel's inputs) — arrow keys there must move the cursor/selection,
 * not the highlighted row. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return target.isContentEditable;
}

/**
 * Persistent row highlight + Up/Down/Home/End keyboard navigation for wide
 * admin tables. Click (or keyboard-focus, since `onFocus` bubbles from any
 * interactive descendant) a row to mark it with `data-selected="true"` —
 * styled in `globals.css` (`.admin-table-row`) — so the user doesn't lose
 * their place while scrolling a wide table horizontally.
 *
 * `ids` is the current *visual* top-to-bottom order of rows so ArrowUp/
 * ArrowDown/Home/End know which row is "next" — pass the same array used to
 * render the rows (e.g. `visible.map((r) => r.id)`); a fresh array literal
 * each render is fine, it doesn't need to be memoized. Ignored while focus
 * is inside an editable control, and only Up/Down/Home/End are handled —
 * Left/Right are left alone (horizontal scroll / native behavior).
 *
 * Selection is UI-only and persists until another row is selected; it never
 * blocks the row's own links/buttons since it only adds handlers to the
 * `<tr>`, it doesn't intercept anything.
 */
export function useSelectedRow(
  ids: string[] = [],
  initialId: string | null = null,
) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const rowNodesRef = useRef(new Map<string, HTMLTableRowElement>());

  const focusRow = useCallback((id: string) => {
    const el = rowNodesRef.current.get(id);
    if (!el) return;
    setSelectedId(id);
    el.focus();
    el.scrollIntoView({ block: "nearest" });
  }, []);

  const rowProps = useCallback(
    (id: string): RowSelectionProps => ({
      "data-selected": selectedId === id ? "true" : undefined,
      ref: (el) => {
        if (el) rowNodesRef.current.set(id, el);
        else rowNodesRef.current.delete(id);
      },
      onClick: () => setSelectedId(id),
      onFocus: () => setSelectedId(id),
      onKeyDown: (e) => {
        if (isEditableTarget(e.target)) return;
        const i = ids.indexOf(id);
        if (i === -1) return;

        let targetId: string | undefined;
        switch (e.key) {
          case "ArrowDown":
            targetId = ids[Math.min(i + 1, ids.length - 1)];
            break;
          case "ArrowUp":
            targetId = ids[Math.max(i - 1, 0)];
            break;
          case "Home":
            targetId = ids[0];
            break;
          case "End":
            targetId = ids[ids.length - 1];
            break;
          default:
            return;
        }
        if (!targetId || targetId === id) return;
        e.preventDefault();
        focusRow(targetId);
      },
    }),
    [selectedId, focusRow, ids],
  );

  return useMemo(
    () => ({ selectedId, setSelectedId, rowProps }),
    [selectedId, rowProps],
  );
}
