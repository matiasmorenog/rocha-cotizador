import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { enqueueAdminInboxTest } from "@/lib/push";

/**
 * POST /api/admin/push/inbox/test
 * Enqueue a test in-app notification.
 */
export async function POST() {
  if (!(await requireStaffApi("quotes"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const item = await enqueueAdminInboxTest();
  return NextResponse.json({ ok: true, item });
}
