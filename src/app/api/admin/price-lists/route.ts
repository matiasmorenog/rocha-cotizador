import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterPriceListMutation } from "@/lib/cache-tags";
import { sortPriceListsForDisplay } from "@/lib/pricing";

export async function GET() {
  if (!(await requireStaffApi("priceLists"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const priceLists = sortPriceListsForDisplay(
    await db.priceList.findMany({
      include: {
        _count: { select: { items: true, customers: true } },
      },
    }),
  );

  return NextResponse.json({
    priceLists: priceLists.map((l) => ({
      id: l.id,
      name: l.name,
      excelKey: l.excelKey,
      isBase: l.isBase,
      active: l.active,
      itemCount: l._count.items,
      customerCount: l._count.customers,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  fillFromBase: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await requireStaffApi("priceLists"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const list = await db.priceList.create({
    data: {
      name: parsed.data.name.trim(),
      active: parsed.data.active ?? true,
    },
  });

  if (parsed.data.fillFromBase) {
    const products = await db.product.findMany({
      where: { available: true },
      select: { id: true, basePrice: true },
    });
    if (products.length > 0) {
      await db.priceListItem.createMany({
        data: products.map((p) => ({
          priceListId: list.id,
          productId: p.id,
          unitPrice: p.basePrice,
        })),
      });
    }
  }

  invalidateAfterPriceListMutation();
  return NextResponse.json({ priceList: list });
}
