import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ARGENTINA_TZ, toArgentinaDatetimeLocal } from "@/lib/argentina-time";
import { CACHE_TAGS } from "@/lib/cache-tags";

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export function argentinaYearMonth(now = new Date()): {
  year: number;
  month: number;
} {
  const local = toArgentinaDatetimeLocal(now);
  const [datePart] = local.split("T");
  const [y, m] = (datePart ?? "").split("-");
  return { year: Number(y), month: Number(m) };
}

export function formatPeriodLabel(year: number, month: number): string {
  const raw = MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function paidAtLabel(paidAt: Date | null): string | null {
  if (!paidAt) return null;
  return new Date(paidAt).toLocaleDateString("es-AR", {
    timeZone: ARGENTINA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type SubscriptionPaymentDto = {
  id: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  amountUsd: number;
  amountArs: number | null;
  fxRate: number | null;
  paidAt: string | null;
  paidAtLocal: string | null;
  paidAtLabel: string | null;
  note: string | null;
};

export type RochaSubscriptionStatus = {
  current: {
    periodYear: number;
    periodMonth: number;
    periodLabel: string;
    paid: boolean;
    paidAtLabel: string | null;
  };
  recentPaid: Array<{
    periodYear: number;
    periodMonth: number;
    periodLabel: string;
    paidAtLabel: string | null;
  }>;
};

function toDto(row: {
  id: string;
  periodYear: number;
  periodMonth: number;
  amountUsd: Prisma.Decimal;
  amountArs: Prisma.Decimal | null;
  fxRate: Prisma.Decimal | null;
  paidAt: Date | null;
  note: string | null;
}): SubscriptionPaymentDto {
  return {
    id: row.id,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    periodLabel: formatPeriodLabel(row.periodYear, row.periodMonth),
    amountUsd: decimalToNumber(row.amountUsd) ?? 100,
    amountArs: decimalToNumber(row.amountArs),
    fxRate: decimalToNumber(row.fxRate),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    paidAtLocal: row.paidAt ? toArgentinaDatetimeLocal(row.paidAt) : null,
    paidAtLabel: paidAtLabel(row.paidAt),
    note: row.note,
  };
}

async function fetchSubscriptionPaymentsUncached(): Promise<
  SubscriptionPaymentDto[]
> {
  const rows = await db.subscriptionPayment.findMany({
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
  return rows.map(toDto);
}

const getCachedSubscriptionPayments = unstable_cache(
  fetchSubscriptionPaymentsUncached,
  ["subscription-payments"],
  { tags: [CACHE_TAGS.subscriptionPayments], revalidate: 86400 },
);

export function getSubscriptionPayments(): Promise<SubscriptionPaymentDto[]> {
  return getCachedSubscriptionPayments();
}

export function listSubscriptionPaymentsUncached(): Promise<
  SubscriptionPaymentDto[]
> {
  return fetchSubscriptionPaymentsUncached();
}

export function buildRochaSubscriptionStatus(
  payments: SubscriptionPaymentDto[],
  now = new Date(),
): RochaSubscriptionStatus {
  const { year, month } = argentinaYearMonth(now);
  const currentRow = payments.find(
    (p) => p.periodYear === year && p.periodMonth === month,
  );
  const paid = Boolean(currentRow?.paidAt);
  const recentPaid = payments
    .filter((p) => p.paidAt)
    .slice(0, 3)
    .map((p) => ({
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      periodLabel: p.periodLabel,
      paidAtLabel: p.paidAtLabel,
    }));

  return {
    current: {
      periodYear: year,
      periodMonth: month,
      periodLabel: formatPeriodLabel(year, month),
      paid,
      paidAtLabel: currentRow?.paidAtLabel ?? null,
    },
    recentPaid,
  };
}

export async function getRochaSubscriptionStatus(): Promise<RochaSubscriptionStatus> {
  const payments = await getSubscriptionPayments();
  return buildRochaSubscriptionStatus(payments);
}
