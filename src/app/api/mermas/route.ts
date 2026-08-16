import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { auth } from "@/lib/auth";
import { customerHasModule } from "@/lib/customer-modules";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import {
  serializeStockItem,
  stockItemListSelect,
} from "@/lib/stock-item-serialize";

const lineSchema = z.object({
  stockItemId: z.string().min(1),
  qty: z.number().nonnegative(),
});

const bodySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "CUSTOMER" ||
    !session.user.customerId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const customerId = session.user.customerId;
  const dateParam = req.nextUrl.searchParams.get("date");
  const entryOnly = req.nextUrl.searchParams.get("entryOnly") === "1";

  const entryDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? parseDateOnlyYmd(dateParam)
      : null;

  const [hasModule, items, entry] = await Promise.all([
    customerHasModule(customerId, "MERMAS"),
    entryOnly
      ? Promise.resolve([])
      : db.stockItem.findMany({
          where: {
            active: true,
            kind: { in: ["RAW_MATERIAL", "BREAD"] },
          },
          orderBy: [
            { kind: "asc" },
            { sortOrder: "asc" },
            { product: { name: "asc" } },
          ],
          select: stockItemListSelect,
        }),
    entryDate
      ? db.mermaEntry.findUnique({
          where: {
            customerId_entryDate: { customerId, entryDate },
          },
          select: {
            id: true,
            notes: true,
            lines: {
              select: { stockItemId: true, qty: true },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!hasModule) {
    return NextResponse.json({ error: "Módulo no habilitado" }, { status: 403 });
  }

  return NextResponse.json({
    items: entryOnly
      ? undefined
      : items.map((i) => {
          const row = serializeStockItem(i);
          return {
            id: row.id,
            code: row.code,
            name: row.name,
            kind: row.kind,
            unit: row.unit,
          };
        }),
    entry: entry
      ? {
          id: entry.id,
          entryDate: dateParam,
          notes: entry.notes,
          lines: entry.lines.map((l) => ({
            stockItemId: l.stockItemId,
            qty: Number(l.qty),
          })),
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "CUSTOMER" ||
    !session.user.customerId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const customerId = session.user.customerId;
  if (!(await customerHasModule(customerId, "MERMAS"))) {
    return NextResponse.json({ error: "Módulo no habilitado" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const entryDate = parseDateOnlyYmd(parsed.data.entryDate);
  if (!entryDate) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const positiveLines = parsed.data.lines.filter((l) => l.qty > 0);
  if (positiveLines.length < 1) {
    return NextResponse.json(
      { error: "Ingresá al menos una cantidad mayor a 0" },
      { status: 400 },
    );
  }

  const itemIds = positiveLines.map((l) => l.stockItemId);
  const validItems = await db.stockItem.findMany({
    where: {
      id: { in: itemIds },
      active: true,
      kind: { in: ["RAW_MATERIAL", "BREAD"] },
    },
    select: { id: true },
  });
  if (validItems.length !== itemIds.length) {
    return NextResponse.json(
      { error: "Hay ítems inválidos en la carga" },
      { status: 400 },
    );
  }

  const entry = await db.$transaction(async (tx) => {
    const existing = await tx.mermaEntry.findUnique({
      where: { customerId_entryDate: { customerId, entryDate } },
      select: { id: true },
    });

    if (existing) {
      await tx.mermaLine.deleteMany({ where: { entryId: existing.id } });
      return tx.mermaEntry.update({
        where: { id: existing.id },
        data: {
          notes: parsed.data.notes?.trim() || null,
          submittedBy: session.user.name ?? session.user.customerCode ?? null,
          lines: {
            create: positiveLines.map((l) => ({
              stockItemId: l.stockItemId,
              qty: new Decimal(l.qty),
            })),
          },
        },
        select: { id: true },
      });
    }

    return tx.mermaEntry.create({
      data: {
        customerId,
        entryDate,
        notes: parsed.data.notes?.trim() || null,
        submittedBy: session.user.name ?? session.user.customerCode ?? null,
        lines: {
          create: positiveLines.map((l) => ({
            stockItemId: l.stockItemId,
            qty: new Decimal(l.qty),
          })),
        },
      },
      select: { id: true },
    });
  });

  return NextResponse.json({ id: entry.id, ok: true });
}
