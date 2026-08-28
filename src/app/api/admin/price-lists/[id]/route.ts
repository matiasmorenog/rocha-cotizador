import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterPriceListMutation } from "@/lib/cache-tags";
import { getBasePriceList } from "@/lib/price-list-resolve";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireStaffApi("priceLists"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const list = await db.priceList.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              rubro: true,
              basePrice: true,
              available: true,
            },
          },
        },
        orderBy: { product: { code: "asc" } },
      },
      _count: { select: { customers: true } },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    priceList: {
      id: list.id,
      name: list.name,
      excelKey: list.excelKey,
      isBase: list.isBase,
      active: list.active,
      customerCount: list._count.customers,
      items: list.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        unitPrice: Number(i.unitPrice),
        product: {
          id: i.product.id,
          code: i.product.code,
          name: i.product.name,
          rubro: i.product.rubro,
          basePrice: Number(i.product.basePrice),
          available: i.product.available,
        },
      })),
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireStaffApi("priceLists"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const priceList = await db.priceList.update({
      where: { id },
      data: {
        ...(parsed.data.name != null
          ? { name: parsed.data.name.trim() }
          : {}),
        ...(parsed.data.active != null ? { active: parsed.data.active } : {}),
      },
    });
    invalidateAfterPriceListMutation();
    return NextResponse.json({ priceList });
  } catch {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
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
  if (list.isBase) {
    return NextResponse.json(
      { error: "No se puede eliminar la lista Precio base" },
      { status: 400 },
    );
  }

  const base = await getBasePriceList();
  await db.$transaction([
    db.customer.updateMany({
      where: { priceListId: id },
      data: { priceListId: base?.id ?? null },
    }),
    db.priceList.delete({ where: { id } }),
  ]);
  invalidateAfterPriceListMutation();
  return NextResponse.json({ ok: true });
}
