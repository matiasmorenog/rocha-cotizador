"use client";

import { useRef } from "react";
import { RemitoAdminItemRows } from "@/components/quote/remito-admin-item-rows";
import { useRemitoEditMode } from "@/components/quote/remito-edit-mode";
import { DataTableScroll } from "@/components/ui/data-table";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { useSmoothColumnWidths } from "@/hooks/use-smooth-column-widths";
import { SEARCH_TABLE_RESIZE_MS } from "@/hooks/use-smooth-list-height";
import { useSelectedRow } from "@/hooks/use-selected-row";
import { cn } from "@/lib/utils";

export type RemitoAdminLine = {
  itemId: string;
  productCode: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  measureLabel: string;
  needsWeighPrice: boolean;
  suggestedKgPrice: number;
  orderedByUnit: boolean;
};

type Props = {
  quoteId: string;
  lines: RemitoAdminLine[];
  canDeleteLine: boolean;
};

/**
 * Admin remito lines table. Actions + weigh/edit panels only in edit mode.
 * Exit keeps the actions column mounted until the width FLIP finishes so
 * leave matches enter (instant unmount skipped the shrink animation).
 */
export function RemitoAdminTable({ quoteId, lines, canDeleteLine }: Props) {
  const { editMode } = useRemitoEditMode();
  const { present: showEditChrome, exiting: editExiting } = useExitPresence(
    editMode,
    SEARCH_TABLE_RESIZE_MS,
  );
  /** Layout “open” — false as soon as exit starts so FLIP collapses actions. */
  const editLayoutOpen = showEditChrome && !editExiting;
  const colSpan = showEditChrome ? 6 : 5;

  const tableRef = useRef<HTMLTableElement>(null);
  // Include showEditChrome so unmount after exit FLIP can releaseLock cleanly
  // (exit keeps a fixed-width lock until the actions column is gone).
  useSmoothColumnWidths(
    tableRef,
    `${lines.length}|${editLayoutOpen}|${showEditChrome}`,
  );
  const { rowProps } = useSelectedRow(lines.map((line) => line.itemId));

  return (
    <DataTableScroll className="data-table-rows-2l rounded-none border-0 bg-transparent shadow-none">
      <table ref={tableRef} className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-neutral-600">
            <th className="py-2 pl-2 pr-2 font-medium">Cód.</th>
            <th className="py-2 pr-2 font-medium">Cant.</th>
            <th className="py-2 pr-2 font-medium">Artículo</th>
            <th className="py-2 pr-2 text-right font-medium">Precio</th>
            <th className="py-2 pr-2 text-right font-medium">Importe</th>
            {showEditChrome ? (
              <th
                className={cn(
                  "w-0 py-2 pl-1 pr-2 print:hidden",
                  editExiting && "overflow-hidden",
                )}
                aria-label="Acciones"
                data-col-collapse={editExiting ? "" : undefined}
              />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <RemitoAdminItemRows
              key={line.itemId}
              quoteId={quoteId}
              itemId={line.itemId}
              productCode={line.productCode}
              productName={line.productName}
              qty={line.qty}
              unitPrice={line.unitPrice}
              lineTotal={line.lineTotal}
              measureLabel={line.measureLabel}
              canDelete={canDeleteLine}
              needsWeighPrice={line.needsWeighPrice}
              suggestedKgPrice={line.suggestedKgPrice}
              orderedByUnit={line.orderedByUnit}
              colSpan={colSpan}
              editMode={editMode}
              showEditChrome={showEditChrome}
              editExiting={editExiting}
              rowProps={rowProps(line.itemId)}
            />
          ))}
        </tbody>
      </table>
    </DataTableScroll>
  );
}
