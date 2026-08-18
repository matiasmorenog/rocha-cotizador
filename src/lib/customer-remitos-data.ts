import { db } from "@/lib/db";
import {
  CUSTOMER_REMITOS_DEFAULT_LIMIT,
  CUSTOMER_REMITOS_FILTERED_LIMIT,
} from "@/lib/customer-remitos-limits";
import { formatDateOnlyYmd } from "@/lib/delivery-date";

export {
  CUSTOMER_REMITOS_DEFAULT_LIMIT,
  CUSTOMER_REMITOS_FILTERED_LIMIT,
} from "@/lib/customer-remitos-limits";

export type CustomerRemitoRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  deliveryDate: string | null;
};

export type CustomerRemitosQuery = {
  from?: Date | null;
  to?: Date | null;
  search?: string | null;
  limit?: number;
};

function mapRow(q: {
  id: string;
  number: string;
  status: string;
  total: unknown;
  createdAt: Date;
  deliveryDate: Date | null;
}): CustomerRemitoRow {
  return {
    id: q.id,
    number: q.number,
    status: q.status,
    total: Number(q.total),
    createdAt: q.createdAt.toISOString(),
    deliveryDate: q.deliveryDate ? formatDateOnlyYmd(q.deliveryDate) : null,
  };
}

/**
 * Customer remitos list — narrow select, bounded take.
 * Default (no range, no search): last N by createdAt.
 */
export async function getCustomerRemitos(
  customerId: string,
  query: CustomerRemitosQuery = {},
): Promise<CustomerRemitoRow[]> {
  const search = query.search?.trim() ?? "";
  const hasDateRange = Boolean(query.from && query.to);
  const hasSearch = search.length > 0;

  const limit =
    query.limit ??
    (hasDateRange || hasSearch
      ? CUSTOMER_REMITOS_FILTERED_LIMIT
      : CUSTOMER_REMITOS_DEFAULT_LIMIT);

  const quotes = await db.quote.findMany({
    where: {
      customerId,
      ...(hasDateRange
        ? { createdAt: { gte: query.from!, lt: query.to! } }
        : {}),
      ...(hasSearch
        ? { number: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      createdAt: true,
      deliveryDate: true,
    },
  });

  return quotes.map(mapRow);
}
