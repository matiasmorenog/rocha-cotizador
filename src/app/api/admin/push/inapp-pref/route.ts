import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const patchSchema = z.object({
  enabled: z.boolean(),
});

/**
 * PATCH /api/admin/push/inapp-pref
 * Persist account-level in-app toast preference (one DB write).
 * Client then calls session.update({ inAppNotificationsEnabled }) — no GET/poll.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: { inAppNotificationsEnabled: parsed.data.enabled },
    select: { inAppNotificationsEnabled: true },
  });

  return NextResponse.json({
    enabled: user.inAppNotificationsEnabled,
  });
}
