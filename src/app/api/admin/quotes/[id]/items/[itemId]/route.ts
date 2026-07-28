import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { auth } from "@/lib/auth";
import { invalidateAfterQuoteItemPriceUpdate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { lineTotal } from "@/lib/pricing";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const bodySchema = z.object({
  /** Confirmed $/kg (or unit) after weigh. */
  unitPrice: z.number().nonnegative(),
  /** Actual kg after cooking/weigh; omit to keep current qty. */
  qty: z.number().positive().optional(),
});

/**
 * PATCH /api/admin/quotes/[id]/items/[itemId]
 * Confirm price (and optional kg) on remito lines that were ordered by unit
 * at $0 pending post-cook weigh.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: quoteId, itemId } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const item = await db.quoteItem.findFirst({
    where: { id: itemId, quoteId },
  });
  if (!item) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  const wasZero = new Decimal(item.unitPrice).equals(0);
  const needsWeigh = item.orderByUnit || wasZero;
  if (!needsWeigh) {
    return NextResponse.json(
      {
        error:
          "Solo se pueden editar líneas pedidas por unidades o con precio en $0 (pendiente de pesaje)",
      },
      { status: 400 },
    );
  }

  if (item.orderByUnit && parsed.data.qty === undefined) {
    return NextResponse.json(
      { error: "Ingresá el kg pesado para confirmar el precio" },
      { status: 400 },
    );
  }

  const unitPrice = new Decimal(parsed.data.unitPrice).toDecimalPlaces(2);
  const qty = new Decimal(parsed.data.qty ?? item.qty);
  if (qty.lte(0)) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  const nextLineTotal = lineTotal(unitPrice, qty);
  // Price confirmed after weigh → qty is kg (or final measure), not pending units.
  const orderByUnit = unitPrice.equals(0) ? item.orderByUnit : false;

  const result = await db.$transaction(async (tx) => {
    await tx.quoteItem.update({
      where: { id: item.id },
      data: {
        unitPrice,
        qty,
        lineTotal: nextLineTotal,
        orderByUnit,
      },
    });

    const items = await tx.quoteItem.findMany({
      where: { quoteId },
      select: { lineTotal: true },
    });
    const total = items.reduce(
      (acc, row) => acc.plus(row.lineTotal),
      new Decimal(0),
    );

    const quote = await tx.quote.update({
      where: { id: quoteId },
      data: {
        subtotal: total.toDecimalPlaces(2),
        total: total.toDecimalPlaces(2),
      },
      select: { id: true, total: true, subtotal: true },
    });

    return quote;
  });

  invalidateAfterQuoteItemPriceUpdate(quoteId);

  return NextResponse.json({
    ok: true,
    quoteId: result.id,
    itemId: item.id,
    unitPrice: Number(unitPrice),
    qty: Number(qty),
    lineTotal: Number(nextLineTotal),
    orderByUnit,
    total: Number(result.total),
  });
}
