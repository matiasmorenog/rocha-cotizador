import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireSuperuserApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseArgentinaDateTime } from "@/lib/argentina-time";
import { invalidateAfterSubscriptionPaymentMutation } from "@/lib/cache-tags";
import { getSubscriptionPayments, listSubscriptionPaymentsUncached } from "@/lib/subscription-payments";

const notFound = () =>
  NextResponse.json({ error: "No encontrado" }, { status: 404 });

const optionalMoney = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : Number.NaN;
  })
  .refine((v) => v == null || (v > 0 && v < 1_000_000_000), {
    message: "Monto inválido",
  });

const upsertSchema = z.object({
  periodYear: z.coerce.number().int().min(2020).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  amountUsd: z.coerce.number().positive().max(1_000_000).default(100),
  amountArs: optionalMoney,
  fxRate: optionalMoney,
  paidAt: z.string().min(1, "Indicá la fecha de pago"),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

export async function GET() {
  if (!(await requireSuperuserApi())) return notFound();
  const payments = await getSubscriptionPayments();
  return NextResponse.json({ payments });
}

export async function PUT(req: NextRequest) {
  if (!(await requireSuperuserApi())) return notFound();

  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { error: first ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const paidAt = parseArgentinaDateTime(parsed.data.paidAt);
  if (!paidAt) {
    return NextResponse.json({ error: "Fecha de pago inválida" }, { status: 400 });
  }

  const data = {
    amountUsd: new Prisma.Decimal(parsed.data.amountUsd.toFixed(2)),
    amountArs:
      parsed.data.amountArs == null
        ? null
        : new Prisma.Decimal(parsed.data.amountArs.toFixed(2)),
    fxRate:
      parsed.data.fxRate == null
        ? null
        : new Prisma.Decimal(parsed.data.fxRate.toFixed(4)),
    paidAt,
    note: parsed.data.note,
  };

  await db.subscriptionPayment.upsert({
    where: {
      periodYear_periodMonth: {
        periodYear: parsed.data.periodYear,
        periodMonth: parsed.data.periodMonth,
      },
    },
    create: {
      periodYear: parsed.data.periodYear,
      periodMonth: parsed.data.periodMonth,
      ...data,
    },
    update: data,
  });

  invalidateAfterSubscriptionPaymentMutation();
  const payments = await listSubscriptionPaymentsUncached();
  return NextResponse.json({ payments });
}
