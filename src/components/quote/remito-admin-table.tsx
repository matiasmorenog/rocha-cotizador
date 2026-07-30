"use client";

import { RemitoAdminItemRows } from "@/components/quote/remito-admin-item-rows";
import { useRemitoEditMode } from "@/components/quote/remito-edit-mode";
import { DataTableScroll } from "@/components/ui/data-table";

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
 */
export function RemitoAdminTable({ quoteId, lines, canDeleteLine }: Props) {
  const { editMode } = useRemitoEditMode();
  const colSpan = editMode ? 6 : 5;

  return (
    <DataTableScroll className="rounded-none border-0 bg-transparent">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-neutral-600">
            <th className="py-2 pl-2 pr-2 font-medium">Cód.</th>
            <th className="py-2 pr-2 font-medium">Cant.</th>
            <th className="py-2 pr-2 font-medium">Artículo</th>
            <th className="py-2 pr-2 text-right font-medium">Precio</th>
            <th className="py-2 pr-2 text-right font-medium">Importe</th>
            {editMode ? (
              <th
                className="w-0 py-2 pl-1 pr-2 print:hidden"
                aria-label="Acciones"
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
            />
          ))}
        </tbody>
      </table>
    </DataTableScroll>
  );
}
