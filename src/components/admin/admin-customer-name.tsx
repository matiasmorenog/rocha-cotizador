import { cn } from "@/lib/utils";

/** Admin-only: main customer name with optional clarification on a second line. */
export function AdminCustomerName({
  name,
  nameNote,
  className,
  noteClassName,
}: {
  name: string;
  nameNote?: string | null;
  className?: string;
  noteClassName?: string;
}) {
  const note = nameNote?.trim();
  if (!note) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span
      className={cn("inline-flex min-w-0 flex-col overflow-hidden", className)}
      // Table cells pass `admin-table-name-2l` (`display: -webkit-box`), which
      // concatenates child text. Inline flex keeps name and note on two lines.
      style={{ display: "inline-flex" }}
    >
      <span className="truncate">{name}</span>
      <span
        className={cn(
          "truncate text-xs font-normal text-neutral-500",
          noteClassName,
        )}
      >
        {note}
      </span>
    </span>
  );
}
