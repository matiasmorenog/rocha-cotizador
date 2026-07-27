import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe. Returns 503 when DB is down or schema is
 * missing columns/tables the app expects (the failure mode that once looked
 * like "wrong password" on admin login).
 */
export async function GET() {
  try {
    await db.user.findFirst({
      select: {
        id: true,
        inAppNotificationsEnabled: true,
      },
    });
    await db.pushSubscription.findFirst({
      select: { id: true },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code =
      err instanceof Prisma.PrismaClientKnownRequestError ? err.code : null;
    // P2021 = table missing, P2022 = column missing
    const schemaBroken = code === "P2021" || code === "P2022";
    return NextResponse.json(
      {
        ok: false,
        error: schemaBroken ? "schema_drift" : "db_unavailable",
      },
      { status: 503 },
    );
  }
}
