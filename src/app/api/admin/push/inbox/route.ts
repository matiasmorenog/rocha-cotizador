import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAdminInboxSince } from "@/lib/push";

/**
 * GET /api/admin/push/inbox?since=<ISO>
 * Lightweight poll for in-app admin alerts (safe path; no OS toast).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sinceRaw = req.nextUrl.searchParams.get("since");
  if (!sinceRaw) {
    return NextResponse.json(
      { error: "Falta query since (ISO datetime)" },
      { status: 400 },
    );
  }

  const since = new Date(sinceRaw);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json(
      { error: "since inválido (usá ISO datetime)" },
      { status: 400 },
    );
  }

  // Ignore very old cursors — cap lookback to 24h to keep query cheap.
  const floor = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const effectiveSince = since < floor ? floor : since;

  const items = await listAdminInboxSince(effectiveSince);
  return NextResponse.json({
    items,
    serverNow: new Date().toISOString(),
  });
}
