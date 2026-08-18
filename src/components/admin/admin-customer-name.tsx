import { cn } from "@/lib/utils";

/** Admin-only: main customer name with optional clarification subtitle. */
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
    <span className={cn("inline-flex flex-col gap-0", className)}>
      <span>{name}</span>
      <span
        className={cn("text-xs font-normal text-neutral-500", noteClassName)}
      >
        ({note})
      </span>
    </span>
  );
}
