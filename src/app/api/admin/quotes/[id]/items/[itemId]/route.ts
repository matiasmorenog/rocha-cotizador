import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { invalidateAfterQuoteItemPriceUpdate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { lineTotal } from "@/lib/pricing";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const patchBodySchema = z
  .object({
    unitPrice: z.number().nonnegative().optional(),
    qty: z.number().positive().optional(),
  })
  .refine((b) => b.unitPrice !== undefined || b.qty !== undefined, {
    message: "qty o unitPrice requerido",
  });

async function recalcQuoteTotals(
  tx: Prisma.TransactionClient,
  quoteId: string,
) {
  const items = await tx.quoteItem.findMany({
    where: { quoteId },
    select: { lineTotal: true },
  });
  const total = items.reduce(
    (acc, row) => acc.plus(row.lineTotal),
    new Decimal(0),
  );
  return tx.quote.update({
    where: { id: quoteId },
    data: {
      subtotal: total.toDecimalPlaces(2),
      total: total.toDecimalPlaces(2),
    },
    select: { id: true, total: true, subtotal: true },
  });
}

/**
 * PATCH /api/admin/quotes/[id]/items/[itemId]
 * Admin edit qty and/or unitPrice on any remito line; recalc totals.
 * Confirming a pending unit-order price (unitPrice > 0) clears orderByUnit.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: quoteId, itemId } = await params;
  const parsed = patchBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const item = await db.quoteItem.findFirst({
    where: { id: itemId, quoteId },
  });
  if (!item) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  const unitPrice =
    parsed.data.unitPrice !== undefined
      ? new Decimal(parsed.data.unitPrice).toDecimalPlaces(2)
      : new Decimal(item.unitPrice);
  const qty =
    parsed.data.qty !== undefined
      ? new Decimal(parsed.data.qty)
      : new Decimal(item.qty);
  if (qty.lte(0)) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  const nextLineTotal = lineTotal(unitPrice, qty);
  // Pending unit-order ($0) → after price set, treat as weighed kg measure.
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
    return recalcQuoteTotals(tx, quoteId);
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

/**
 * DELETE /api/admin/quotes/[id]/items/[itemId]
 * Remove a remito line and recalc totals. Blocks if it is the only item.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: quoteId, itemId } = await params;

  const item = await db.quoteItem.findFirst({
    where: { id: itemId, quoteId },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  const itemCount = await db.quoteItem.count({ where: { quoteId } });
  if (itemCount <= 1) {
    return NextResponse.json(
      {
        error:
          "No se puede eliminar la única línea del remito. Corregí cantidad o precio, o creá un remito nuevo.",
      },
      { status: 400 },
    );
  }

  const result = await db.$transaction(async (tx) => {
    await tx.quoteItem.delete({ where: { id: item.id } });
    return recalcQuoteTotals(tx, quoteId);
  });

  invalidateAfterQuoteItemPriceUpdate(quoteId);

  return NextResponse.json({
    ok: true,
    quoteId: result.id,
    deletedItemId: item.id,
    total: Number(result.total),
  });
}
