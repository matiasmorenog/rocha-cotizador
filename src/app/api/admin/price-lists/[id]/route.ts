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

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
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
              active: true,
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
          active: i.product.active,
        },
      })),
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) {
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
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    await db.priceList.delete({ where: { id } });
    invalidateAfterPriceListMutation();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }
}
