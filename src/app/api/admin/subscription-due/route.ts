import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { getSubscriptionDueReminder } from "@/lib/subscription-payments";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Lightweight due-reminder flag for any /admin staff session. */
export async function GET() {
  if (!(await requireStaffApi())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const reminder = await getSubscriptionDueReminder();
  return NextResponse.json(reminder);
}
