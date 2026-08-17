import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterProductMutation } from "@/lib/cache-tags";
import { syncBaseListItemForProduct } from "@/lib/price-list-resolve";
import {
  listDistinctProductRubros,
  maybeInvalidateProductRubrosCache,
  normalizeRubro,
} from "@/lib/stock-rubros";

const schema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  rubro: z.string().optional().nullable(),
  /** Client-side Tipo options (uniq from product list) — avoids extra fetch. */
  knownRubros: z.array(z.string()).optional(),
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
  if (!(await requireStaffApi("products"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const rubro = normalizeRubro(parsed.data.rubro ?? null);
  const knownRubros =
    parsed.data.knownRubros ?? (await listDistinctProductRubros());

  const data = {
    code: parsed.data.code.trim(),
    name: parsed.data.name.trim(),
    rubro,
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
  // product-rubros tag: only when this save introduced a brand-new Tipo string.
  await maybeInvalidateProductRubrosCache(product.rubro, knownRubros);

  return NextResponse.json({ product });
}
