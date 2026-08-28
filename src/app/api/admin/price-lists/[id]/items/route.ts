import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterPriceListMutation } from "@/lib/cache-tags";

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

/** Upsert unit prices for products on this list. Base list also syncs Product.basePrice. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  if (!(await requireStaffApi("priceLists"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const list = await db.priceList.findUnique({
    where: { id },
    select: { id: true, isBase: true },
  });
  if (!list) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    for (const item of parsed.data.items) {
      await tx.priceListItem.upsert({
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
      });
      if (list.isBase) {
        await tx.product.update({
          where: { id: item.productId },
          data: { basePrice: item.unitPrice },
        });
      }
    }
  });

  invalidateAfterPriceListMutation();
  return NextResponse.json({ ok: true, count: parsed.data.items.length });
}

const fillSchema = z.object({
  action: z.literal("fillFromBase"),
});

/** Fill missing/overwrite all items from Product.basePrice. No-op-ish on base list. */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await requireStaffApi("priceLists"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const list = await db.priceList.findUnique({
    where: { id },
    select: { id: true, isBase: true },
  });
  if (!list) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const parsed = fillSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (list.isBase) {
    return NextResponse.json(
      { error: "La lista Precio base ya usa Product.basePrice" },
      { status: 400 },
    );
  }

  const products = await db.product.findMany({
    where: { available: true },
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
