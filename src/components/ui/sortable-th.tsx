"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { SortDir } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";

export function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onToggle,
  className,
  align = "left",
}: {
  label: ReactNode;
  sortKey: K;
  activeKey: K | null | undefined;
  dir: SortDir | null | undefined;
  onToggle: (key: K) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  const ariaSort = !active
    ? "none"
    : dir === "asc"
      ? "ascending"
      : "descending";

  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : null;

  return (
    <th
      className={cn(
        "px-3 py-2 font-medium transition-colors",
        align === "right" && "text-right",
        active && "font-semibold text-[var(--brand-primary)]",
        className,
      )}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-sm text-inherit",
          align === "right" && "flex-row-reverse",
          active
            ? "text-[var(--brand-primary)]"
            : "hover:text-neutral-900",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        {/* Fixed slot — no layout jump when icon mounts. */}
        <span
          className="inline-flex size-3.5 shrink-0 items-center justify-center"
          aria-hidden
        >
          {Icon ? <Icon className="size-3.5 opacity-90" /> : null}
        </span>
      </button>
    </th>
  );
}
