import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";

const moduleSchema = z.enum(["MERMAS", "CONSUMABLES"]);

const patchSchema = z.object({
  customerId: z.string().min(1),
  module: moduleSchema,
  enabled: z.boolean(),
});

export async function GET(req: NextRequest) {
  if (!(await requireStaffApi("customerModules"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const customers = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { code: "asc" },
    take: q ? 50 : 500,
    select: {
      id: true,
      code: true,
      name: true,
      active: true,
      moduleAccess: {
        select: { module: true, enabled: true },
      },
    },
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      active: c.active,
      modules: {
        MERMAS: Boolean(
          c.moduleAccess.find((m) => m.module === "MERMAS" && m.enabled),
        ),
        CONSUMABLES: Boolean(
          c.moduleAccess.find((m) => m.module === "CONSUMABLES" && m.enabled),
        ),
      },
    })),
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireStaffApi("customerModules"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const customer = await db.customer.findUnique({
    where: { id: parsed.data.customerId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const row = await db.customerModuleAccess.upsert({
    where: {
      customerId_module: {
        customerId: parsed.data.customerId,
        module: parsed.data.module,
      },
    },
    create: {
      customerId: parsed.data.customerId,
      module: parsed.data.module,
      enabled: parsed.data.enabled,
    },
    update: { enabled: parsed.data.enabled },
    select: { module: true, enabled: true },
  });

  return NextResponse.json({ module: row });
}
