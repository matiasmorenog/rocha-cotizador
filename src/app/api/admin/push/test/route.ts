import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendTestPushToAdmin } from "@/lib/push";

const schema = z.object({
  endpoint: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await sendTestPushToAdmin({
    userId: session.user.id,
    endpoint: parsed.data.endpoint,
  });

  if (result.total === 0) {
    return NextResponse.json(
      {
        ok: false,
        needResub: true,
        sent: 0,
        total: 0,
        staleRemoved: 0,
        error:
          "No hay suscripción guardada para este admin. Activá notificaciones primero.",
      },
      { status: 404 },
    );
  }

  if (result.ok === 0) {
    const stale = result.staleRemoved > 0;
    return NextResponse.json(
      {
        ok: false,
        needResub: true,
        sent: 0,
        total: result.total,
        staleRemoved: result.staleRemoved,
        error: stale
          ? "Suscripción expirada — Activá notificaciones de nuevo"
          : "FCM/web-push falló para todas las suscripciones.",
      },
      { status: stale ? 410 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    needResub: false,
    sent: result.ok,
    total: result.total,
    staleRemoved: result.staleRemoved,
    message:
      "Push enviado. Si no ves toast OS, mirá consola del service worker.",
  });
}
