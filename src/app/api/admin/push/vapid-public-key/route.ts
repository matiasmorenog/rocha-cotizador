import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-permissions";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "VAPID no configurado" },
      { status: 503 },
    );
  }

  return NextResponse.json({ publicKey });
}
