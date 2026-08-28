import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireStaffApi, requireSuperuserApi } from "@/lib/api-auth";
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

const createSchema = z.object({
  periodYear: z.coerce.number().int().min(2020).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  amountUsd: z.coerce.number().positive().max(1_000_000).default(100),
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
  if (!(await requireStaffApi("settings"))) return notFound();
  const payments = await getSubscriptionPayments();
  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest) {
  if (!(await requireSuperuserApi())) return notFound();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
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

  try {
    await db.subscriptionPayment.create({
      data: {
        periodYear: parsed.data.periodYear,
        periodMonth: parsed.data.periodMonth,
        amountUsd: new Prisma.Decimal(parsed.data.amountUsd.toFixed(2)),
        fxRate:
          parsed.data.fxRate == null
            ? null
            : new Prisma.Decimal(parsed.data.fxRate.toFixed(4)),
        paidAt,
        note: parsed.data.note,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Ya existe un pago para ese período" },
      { status: 409 },
    );
  }

  invalidateAfterSubscriptionPaymentMutation();
  const payments = await listSubscriptionPaymentsUncached();
  return NextResponse.json({ payments });
}
