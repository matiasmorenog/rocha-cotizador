"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

/** Props returned by `rowProps(id)` — spread onto a `<tr>` (or any other
 * focusable row-like element, e.g. `<li>`, via the `El` type param). */
export type RowSelectionProps<El extends HTMLElement = HTMLTableRowElement> = {
  "data-selected": "true" | undefined;
  ref: (el: El | null) => void;
  onMouseDown: (e: ReactMouseEvent<El>) => void;
  onClick: (e: ReactMouseEvent<El>) => void;
  onFocus: () => void;
  onKeyDown: (e: ReactKeyboardEvent<El>) => void;
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

/** Buttons/links/inputs on the row — click must not toggle selection. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("button, a, input, textarea, select, label"),
  );
}

/**
 * Persistent row highlight + Up/Down/Home/End keyboard navigation for wide
 * admin tables. Click (or keyboard-focus, since `onFocus` bubbles from any
 * interactive descendant) a row to mark it with `data-selected="true"` —
 * styled in `globals.css` (`.admin-table-row`) — so the user doesn't lose
 * their place while scrolling a wide table horizontally.
 *
 * Click the selected row again to deselect (toggle). Escape clears selection
 * when focus is not in an editable; if focus is in an input, Escape blurs
 * first so a second Escape can deselect.
 *
 * `ids` is the current *visual* top-to-bottom order of rows so ArrowUp/
 * ArrowDown/Home/End know which row is "next" — pass the same array used to
 * render the rows (e.g. `visible.map((r) => r.id)`); a fresh array literal
 * each render is fine, it doesn't need to be memoized. Ignored while focus
 * is inside an editable control, and only Up/Down/Home/End are handled —
 * Left/Right are left alone (horizontal scroll / native behavior).
 *
 * Selection is UI-only; it never blocks the row's own links/buttons since
 * interactive targets skip the toggle handler.
 */
export function useSelectedRow<El extends HTMLElement = HTMLTableRowElement>(
  ids: string[] = [],
  initialId: string | null = null,
) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const rowNodesRef = useRef(new Map<string, El>());
  /** Whether the row was already selected at pointer-down — used so a click
   * that also focuses the row can still toggle off (focus would re-select). */
  const wasSelectedOnPointerDownRef = useRef(false);

  const focusRow = useCallback((id: string) => {
    const el = rowNodesRef.current.get(id);
    if (!el) return;
    setSelectedId(id);
    el.focus();
    el.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    const id = selectedId;

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;

      if (isEditableTarget(e.target)) {
        (e.target as HTMLElement).blur();
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const row = rowNodesRef.current.get(id);
      setSelectedId(null);
      if (row && document.activeElement === row) {
        row.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  const rowProps = useCallback(
    (id: string): RowSelectionProps<El> => ({
      "data-selected": selectedId === id ? "true" : undefined,
      ref: (el) => {
        if (el) rowNodesRef.current.set(id, el);
        else rowNodesRef.current.delete(id);
      },
      onMouseDown: (e) => {
        if (isInteractiveTarget(e.target)) return;
        wasSelectedOnPointerDownRef.current = selectedId === id;
      },
      onClick: (e) => {
        if (isInteractiveTarget(e.target)) return;
        if (wasSelectedOnPointerDownRef.current) {
          setSelectedId(null);
        } else {
          setSelectedId(id);
        }
      },
      onFocus: () => setSelectedId(id),
      onKeyDown: (e) => {
        if (isEditableTarget(e.target)) return;

        if (e.key === "Escape") {
          if (selectedId === id) {
            e.preventDefault();
            setSelectedId(null);
            (e.currentTarget as HTMLElement).blur();
          }
          return;
        }

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
