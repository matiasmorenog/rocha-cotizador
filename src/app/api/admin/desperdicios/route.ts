import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { loadDesperdiciosEntries } from "@/lib/admin-stock-data";
import { invalidateAfterStockEntryMutation } from "@/lib/cache-tags";
import {
  loadStockEntryForDate,
  stockEntryBodySchema,
  upsertStockEntry,
} from "@/lib/stock-entry-api";

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
      "DESPERDICIOS",
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

  const fromParam = req.nextUrl.searchParams.get("from") ?? "";
  const toParam = req.nextUrl.searchParams.get("to") ?? "";

  const entries = await loadDesperdiciosEntries(
    fromParam,
    toParam,
    customerId || undefined,
    200,
  );

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await requireStaffApi("stockReports");
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const parsed = stockEntryBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await upsertStockEntry(
    "DESPERDICIOS",
    parsed.data.customerId,
    parsed.data,
    session?.user?.name ?? session?.user?.email ?? null,
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  invalidateAfterStockEntryMutation();
  return NextResponse.json({ id: result.id, ok: true });
}
