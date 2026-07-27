import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { invalidateAfterQuoteWipe } from "@/lib/cache-tags";

/**
 * POST /api/revalidate
 * Secured hook for ops scripts (e.g. wipe-quotes) to bust Vercel Data Cache /
 * route caches after out-of-band DB mutations.
 *
 * Header: Authorization: Bearer $REVALIDATE_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  invalidateAfterQuoteWipe();
  revalidatePath("/admin");
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/remitos");

  return NextResponse.json({ ok: true, revalidated: true });
}
