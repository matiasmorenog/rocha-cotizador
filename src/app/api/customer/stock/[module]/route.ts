import { NextRequest, NextResponse } from "next/server";
import type { CustomerModule } from "@prisma/client";
import { requireCustomerModuleApi } from "@/lib/customer-api-auth";
import { customerStockModuleFromApiSegment } from "@/lib/customer-stock-shared";
import {
  loadActivosEntries,
  loadConsumiblesEntries,
  loadDesperdiciosEntries,
} from "@/lib/admin-stock-data";
import { invalidateAfterStockEntryMutation } from "@/lib/cache-tags";
import {
  loadStockEntryForDate,
  stockEntryBodySchema,
  upsertStockEntry,
} from "@/lib/stock-entry-api";

type RouteContext = { params: Promise<{ module: string }> };

async function loadEntries(
  customerModule: CustomerModule,
  from: string,
  to: string,
  customerId: string,
) {
  if (customerModule === "CONSUMABLES") {
    return loadConsumiblesEntries(from, to, customerId, 200);
  }
  if (customerModule === "ACTIVOS") {
    return loadActivosEntries(from, to, customerId, 200);
  }
  return loadDesperdiciosEntries(from, to, customerId, 200);
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { module: segment } = await context.params;
  const customerModule = customerStockModuleFromApiSegment(segment);
  if (!customerModule) {
    return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  }

  const ctx = await requireCustomerModuleApi(customerModule);
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const entryOnly = req.nextUrl.searchParams.get("entryOnly") === "1";

  if (entryOnly) {
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }
    const entry = await loadStockEntryForDate(
      customerModule,
      ctx.customerId,
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
  const entries = await loadEntries(
    customerModule,
    fromParam,
    toParam,
    ctx.customerId,
  );

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { module: segment } = await context.params;
  const customerModule = customerStockModuleFromApiSegment(segment);
  if (!customerModule) {
    return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  }

  const ctx = await requireCustomerModuleApi(customerModule);
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = stockEntryBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.customerId !== ctx.customerId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const submittedBy =
    ctx.session.user.name ?? ctx.session.user.customerCode ?? null;

  const result = await upsertStockEntry(
    customerModule,
    ctx.customerId,
    parsed.data,
    submittedBy,
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  invalidateAfterStockEntryMutation();
  return NextResponse.json({ id: result.id, ok: true });
}
