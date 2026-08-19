import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import { db } from "@/lib/db";

const patchSchema = z.object({
  enabled: z.boolean(),
});

/**
 * Persist via typed update; fall back to raw SQL when the long-lived
 * PrismaClient in `next dev` is stale after `prisma generate` (unknown arg).
 */
async function setInAppNotificationsEnabled(
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { inAppNotificationsEnabled: enabled },
      select: { inAppNotificationsEnabled: true },
    });
    return user.inAppNotificationsEnabled;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientValidationError)) throw err;
    console.warn(
      "[inapp-pref] typed update rejected — using raw SQL (stale Prisma client?)",
    );
    await db.$executeRaw`
      UPDATE "User"
      SET "inAppNotificationsEnabled" = ${enabled},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
    return enabled;
  }
}

/**
 * PATCH /api/admin/push/inapp-pref
 * Persist account-level in-app toast preference (one DB write).
 * Client then calls session.update({ inAppNotificationsEnabled }) — no GET/poll.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireStaffApi("quotes");
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const enabled = await setInAppNotificationsEnabled(
      session.user.id,
      parsed.data.enabled,
    );
    return NextResponse.json({ enabled });
  } catch (err) {
    console.error("[inapp-pref] update failed", err);
    return NextResponse.json(
      { error: "No se pudo guardar la preferencia" },
      { status: 500 },
    );
  }
}
