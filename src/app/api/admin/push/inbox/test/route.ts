import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-permissions";
import { enqueueAdminInboxTest } from "@/lib/push";

/**
 * POST /api/admin/push/inbox/test
 * Enqueue a test in-app notification.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const item = await enqueueAdminInboxTest();
  return NextResponse.json({ ok: true, item });
}
