import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { DEFAULT_STOCK_UNIT, STOCK_UNITS } from "@/lib/stock-units";

const kindSchema = z.enum(["RAW_MATERIAL", "BREAD", "CONSUMABLE"]);
const unitSchema = z.enum(STOCK_UNITS);

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
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
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      kind: i.kind,
      unit: i.unit,
      active: i.active,
      sortOrder: i.sortOrder,
    })),
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

  const code = parsed.data.code.trim().toUpperCase();

  if (parsed.data.id) {
    const taken = await db.stockItem.findFirst({
      where: { code, NOT: { id: parsed.data.id } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Código ya en uso" }, { status: 409 });
    }
    const item = await db.stockItem.update({
      where: { id: parsed.data.id },
      data: {
        code,
        name: parsed.data.name.trim(),
        kind: parsed.data.kind,
        unit: parsed.data.unit,
        active: parsed.data.active,
        sortOrder: parsed.data.sortOrder,
      },
    });
    return NextResponse.json({ item });
  }

  const taken = await db.stockItem.findUnique({
    where: { code },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "Código ya en uso" }, { status: 409 });
  }

  const item = await db.stockItem.create({
    data: {
      code,
      name: parsed.data.name.trim(),
      kind: parsed.data.kind,
      unit: parsed.data.unit,
      active: parsed.data.active,
      sortOrder: parsed.data.sortOrder,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
