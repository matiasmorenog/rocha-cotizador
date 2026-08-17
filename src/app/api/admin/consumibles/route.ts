import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parseDateOnlyYmd } from "@/lib/delivery-date";
import {
  loadStockEntryForDate,
  stockEntryBodySchema,
  upsertStockEntry,
} from "@/lib/stock-entry-api";
import {
  serializeStockLine,
  stockLineSelect,
} from "@/lib/stock-line-serialize";

export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("stockReports"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const customerId = (req.nextUrl.searchParams.get("customerId") ?? "").trim();
  const dateParam = req.nextUrl.searchParams.get("date");
  const entryOnly = req.nextUrl.searchParams.get("entryOnly") === "1";

  if (entryOnly) {
    if (!customerId || !dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }
    const entry = await loadStockEntryForDate(
      "CONSUMABLES",
      customerId,
      dateParam,
    );
    return NextResponse.json({
      entry: entry
        ? {
            id: entry.id,
            notes: entry.notes,
            lines: entry.lines.map((l) => ({
              productId: l.productId,
              unit: l.unit,
              qty: Number(l.qty),
              product: {
                code: l.product.code,
                name: l.product.name,
                rubro: l.product.rubro,
                allowsUnitOrder: l.product.allowsUnitOrder,
              },
            })),
          }
        : null,
    });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const from = fromParam ? parseDateOnlyYmd(fromParam) : null;
  const to = toParam ? parseDateOnlyYmd(toParam) : null;

  const entries = await db.consumableCount.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(from || to
        ? {
            entryDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      entryDate: true,
      notes: true,
      submittedBy: true,
      customer: { select: { code: true, name: true } },
      lines: { select: stockLineSelect },
    },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      notes: e.notes,
      submittedBy: e.submittedBy,
      customer: e.customer,
      lines: e.lines.map(serializeStockLine),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireStaffApi("stockReports"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const session = await auth();
  const parsed = stockEntryBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await upsertStockEntry(
    "CONSUMABLES",
    parsed.data.customerId,
    parsed.data,
    session?.user?.name ?? session?.user?.email ?? null,
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ id: result.id, ok: true });
}
