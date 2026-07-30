"use client";

import { useCallback, useMemo, useState } from "react";

/** Props returned by `rowProps(id)` — spread onto a `<tr>`. */
export type RowSelectionProps = {
  "data-selected": "true" | undefined;
  onClick: () => void;
  onFocus: () => void;
};

/**
 * Persistent row highlight for wide admin tables. Click (or keyboard-focus,
 * since `onFocus` bubbles from any interactive descendant) a row to mark it
 * with `data-selected="true"` — styled in `globals.css` (`.admin-table-row`)
 * — so the user doesn't lose their place while scrolling a wide table
 * horizontally. Selection is UI-only and persists until another row is
 * selected; it never blocks the row's own links/buttons since it only adds
 * handlers to the `<tr>`, it doesn't intercept anything.
 */
export function useSelectedRow(initialId: string | null = null) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId);

  const rowProps = useCallback(
    (id: string): RowSelectionProps => ({
      "data-selected": selectedId === id ? "true" : undefined,
      onClick: () => setSelectedId(id),
      onFocus: () => setSelectedId(id),
    }),
    [selectedId],
  );

  return useMemo(
    () => ({ selectedId, setSelectedId, rowProps }),
    [selectedId, rowProps],
  );
}
