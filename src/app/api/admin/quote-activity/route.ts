import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminQuoteActivity } from "@/lib/admin-quote-activity";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * GET /api/admin/quote-activity?period=week|month|year
 *
 * Chart-only data for the dashboard's period toggle — lets the client swap
 * Semana/Mes/Año without reloading KPIs or the recent-quotes list. Reuses
 * `getAdminQuoteActivity`'s tagged Data Cache (key: Argentina day + period,
 * tag `admin-dashboard`), so no extra DB round trip beyond the existing
 * Prisma singleton and no separate cache invalidation surface.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get("period") ?? undefined;
  const activity = await getAdminQuoteActivity(period);

  return NextResponse.json(activity, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
