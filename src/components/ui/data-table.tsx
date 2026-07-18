import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll wrapper for wide data tables (mobile).
 * Frame classes live on the same node as overflow-x so border-radius clips thead.
 */
export function DataTableScroll({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "data-table-scroll rounded-lg border border-neutral-200 bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}
