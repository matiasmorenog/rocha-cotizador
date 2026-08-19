import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  if (!(await requireStaffApi("quotes"))) {
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
