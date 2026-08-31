import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateAfterProductMutation } from "@/lib/cache-tags";
import { syncBaseListItemForProduct } from "@/lib/price-list-resolve";
import { normalizeRubro, inferStockKindFromRubro } from "@/lib/stock-rubros";
import {
  normalizeAllowsUnitOrder,
  productSupportsUnitOrKgOrder,
  type ProductStockKindValue,
} from "@/lib/stock-product-kind-shared";

const stockKindSchema = z.enum(["DESPERDICIO", "CONSUMABLE", "LOCAL_ASSET"]).nullable();

const schema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  rubro: z.string().optional().nullable(),
  basePrice: z.number().nonnegative(),
  allowsUnitOrder: z.boolean().optional(),
  available: z.boolean().optional(),
  stockKind: stockKindSchema.optional(),
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

  const stockKindInPayload = parsed.data.stockKind !== undefined;
  const allowsInPayload = parsed.data.allowsUnitOrder !== undefined;

  let effectiveStockKind: ProductStockKindValue;
  if (stockKindInPayload) {
    effectiveStockKind =
      parsed.data.stockKind ?? inferStockKindFromRubro(rubro);
  } else if (parsed.data.id) {
    const existing = await db.product.findUnique({
      where: { id: parsed.data.id },
      select: { stockKind: true },
    });
    effectiveStockKind =
      existing?.stockKind ?? inferStockKindFromRubro(rubro);
  } else {
    effectiveStockKind = inferStockKindFromRubro(rubro);
  }

  const data: {
    code: string;
    name: string;
    rubro: string | null;
    basePrice: number;
    available: boolean;
    stockKind?: ProductStockKindValue | null;
    allowsUnitOrder?: boolean;
  } = {
    code: parsed.data.code.trim(),
    name: parsed.data.name.trim(),
    rubro,
    basePrice: parsed.data.basePrice,
    available: parsed.data.available ?? true,
    ...(stockKindInPayload
      ? { stockKind: parsed.data.stockKind }
      : parsed.data.id
        ? {}
        : { stockKind: inferStockKindFromRubro(rubro) }),
  };

  if (allowsInPayload) {
    data.allowsUnitOrder = normalizeAllowsUnitOrder(
      effectiveStockKind,
      parsed.data.allowsUnitOrder!,
    );
  } else if (stockKindInPayload && !productSupportsUnitOrKgOrder(effectiveStockKind)) {
    data.allowsUnitOrder = false;
  } else if (!parsed.data.id) {
    data.allowsUnitOrder = false;
  }

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
