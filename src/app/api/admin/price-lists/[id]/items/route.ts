import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateAfterPriceListMutation } from "@/lib/cache-tags";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .min(1),
});

/** Upsert unit prices for products on this list. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const list = await db.priceList.findUnique({ where: { id } });
  if (!list) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await db.$transaction(
    parsed.data.items.map((item) =>
      db.priceListItem.upsert({
        where: {
          priceListId_productId: {
            priceListId: id,
            productId: item.productId,
          },
        },
        create: {
          priceListId: id,
          productId: item.productId,
          unitPrice: item.unitPrice,
        },
        update: { unitPrice: item.unitPrice },
      }),
    ),
  );

  invalidateAfterPriceListMutation();
  return NextResponse.json({ ok: true, count: parsed.data.items.length });
}

const fillSchema = z.object({
  action: z.literal("fillFromBase"),
});

/** Fill missing/overwrite all items from Product.basePrice. */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const list = await db.priceList.findUnique({ where: { id } });
  if (!list) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const parsed = fillSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const products = await db.product.findMany({
    where: { active: true },
    select: { id: true, basePrice: true },
  });

  await db.$transaction(
    products.map((p) =>
      db.priceListItem.upsert({
        where: {
          priceListId_productId: { priceListId: id, productId: p.id },
        },
        create: {
          priceListId: id,
          productId: p.id,
          unitPrice: p.basePrice,
        },
        update: { unitPrice: p.basePrice },
      }),
    ),
  );

  invalidateAfterPriceListMutation();
  return NextResponse.json({ ok: true, count: products.length });
}
