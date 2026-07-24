import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateAfterProductMutation } from "@/lib/cache-tags";
import { syncBaseListItemForProduct } from "@/lib/price-list-resolve";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const schema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  rubro: z.string().optional().nullable(),
  basePrice: z.number().nonnegative(),
  allowsUnitOrder: z.boolean().optional(),
  active: z.boolean().optional(),
  listPrices: z
    .array(
      z.object({
        priceListId: z.string().min(1),
        unitPrice: z.number().nonnegative().nullable(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const data = {
    code: parsed.data.code.trim(),
    name: parsed.data.name.trim(),
    rubro: parsed.data.rubro ?? null,
    basePrice: parsed.data.basePrice,
    active: parsed.data.active ?? true,
    ...(parsed.data.allowsUnitOrder !== undefined
      ? { allowsUnitOrder: parsed.data.allowsUnitOrder }
      : parsed.data.id
        ? {}
        : { allowsUnitOrder: false }),
  };

  const product = parsed.data.id
    ? await db.product.update({ where: { id: parsed.data.id }, data })
    : await db.product.create({ data });

  await syncBaseListItemForProduct(product.id, product.basePrice);

  if (parsed.data.listPrices) {
    const base = await db.priceList.findFirst({
      where: { isBase: true },
      select: { id: true },
    });
    for (const row of parsed.data.listPrices) {
      if (base && row.priceListId === base.id) continue;
      if (row.unitPrice === null) {
        await db.priceListItem.deleteMany({
          where: {
            priceListId: row.priceListId,
            productId: product.id,
          },
        });
        continue;
      }
      await db.priceListItem.upsert({
        where: {
          priceListId_productId: {
            priceListId: row.priceListId,
            productId: product.id,
          },
        },
        create: {
          priceListId: row.priceListId,
          productId: product.id,
          unitPrice: row.unitPrice,
        },
        update: { unitPrice: row.unitPrice },
      });
    }
  }

  invalidateAfterProductMutation();

  return NextResponse.json({ product });
}
