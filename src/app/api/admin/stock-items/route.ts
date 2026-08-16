import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { DEFAULT_STOCK_UNIT, STOCK_UNITS } from "@/lib/stock-units";
import {
  serializeStockItem,
  stockItemListSelect,
} from "@/lib/stock-item-serialize";

const kindSchema = z.enum(["RAW_MATERIAL", "BREAD", "CONSUMABLE"]);
const unitSchema = z.enum(STOCK_UNITS);

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  productId: z.string().min(1),
  kind: kindSchema,
  unit: unitSchema.default(DEFAULT_STOCK_UNIT),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("stockCatalog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get("kind");
  const kindFilter =
    kind && kindSchema.safeParse(kind).success
      ? (kind as z.infer<typeof kindSchema>)
      : undefined;

  const items = await db.stockItem.findMany({
    where: kindFilter ? { kind: kindFilter } : undefined,
    orderBy: [
      { kind: "asc" },
      { sortOrder: "asc" },
      { product: { name: "asc" } },
    ],
    select: stockItemListSelect,
  });

  return NextResponse.json({
    items: items.map(serializeStockItem),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireStaffApi("stockCatalog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, active: true },
  });
  if (!product) {
    return NextResponse.json(
      { error: "Producto no encontrado" },
      { status: 404 },
    );
  }

  if (parsed.data.id) {
    const existing = await db.stockItem.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, productId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }
    if (existing.productId !== parsed.data.productId) {
      return NextResponse.json(
        { error: "No se puede cambiar el producto de una membresía existente" },
        { status: 400 },
      );
    }
    const item = await db.stockItem.update({
      where: { id: parsed.data.id },
      data: {
        kind: parsed.data.kind,
        unit: parsed.data.unit,
        active: parsed.data.active,
        sortOrder: parsed.data.sortOrder,
      },
      select: stockItemListSelect,
    });
    return NextResponse.json({ item: serializeStockItem(item) });
  }

  const taken = await db.stockItem.findUnique({
    where: { productId: parsed.data.productId },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: "Ese producto ya está en el catálogo de stock" },
      { status: 409 },
    );
  }

  const item = await db.stockItem.create({
    data: {
      productId: parsed.data.productId,
      kind: parsed.data.kind,
      unit: parsed.data.unit,
      active: parsed.data.active,
      sortOrder: parsed.data.sortOrder,
    },
    select: stockItemListSelect,
  });
  return NextResponse.json(
    { item: serializeStockItem(item) },
    { status: 201 },
  );
}
