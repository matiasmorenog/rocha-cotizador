import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

/** List this admin's stored endpoints (for client ↔ DB match after Activar). */
export async function GET() {
  const session = await requireStaffApi();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await db.pushSubscription.findMany({
    where: { userId: session.user.id },
    select: { id: true, endpoint: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    endpoints: rows.map((r) => r.endpoint),
    subscriptions: rows,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireStaffApi();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = subscribeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { endpoint, keys, userAgent } = parsed.data;
  const sub = await db.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
    update: {
      userId: session.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
  });

  return NextResponse.json({ id: sub.id, ok: true, endpoint: sub.endpoint });
}

const deleteSchema = z.object({
  endpoint: z.string().url(),
});

export async function DELETE(req: NextRequest) {
  const session = await requireStaffApi();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await db.pushSubscription.deleteMany({
    where: {
      endpoint: parsed.data.endpoint,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
