"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSelectedRow } from "@/hooks/use-selected-row";
import type { AdminDashboardRecentQuote } from "@/lib/admin-dashboard-cache";
import { formatPrice } from "@/lib/utils";

/**
 * Dashboard "Últimas cotizaciones" feed. Same hover/select visual language
 * as the admin tables (`.admin-table-row` + `useSelectedRow`): grayish hover,
 * sage persistent selection, Up/Down/Home/End to move between rows.
 */
export function RecentQuotesList({
  recent,
}: {
  recent: AdminDashboardRecentQuote[];
}) {
  const ids = useMemo(() => recent.map((q) => q.id), [recent]);
  const { rowProps } = useSelectedRow<HTMLLIElement>(ids);

  if (recent.length === 0) {
    return (
      <ul className="divide-y divide-neutral-100 text-sm">
        <li className="px-4 py-8 text-center text-neutral-500">
          Sin cotizaciones aún
        </li>
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 text-sm">
      {recent.map((q) => (
        <li
          key={q.id}
          {...rowProps(q.id)}
          tabIndex={0}
          className="admin-table-row flex items-center justify-between px-4 py-3"
        >
          <div>
            <Link
              href={`/remitos/${q.id}`}
              className="font-medium text-[var(--brand-primary)] hover:underline"
            >
              {q.number}
            </Link>
            <p className="text-neutral-500">
              {q.customer.code} — {q.customer.name}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">{formatPrice(q.total)}</p>
            <p className="text-xs text-neutral-500">
              {new Date(q.createdAt).toLocaleString("es-AR")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
