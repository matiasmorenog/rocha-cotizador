import { NextRequest, NextResponse } from "next/server";
import { CACHE_TAGS, invalidateAfterDbScript } from "@/lib/cache-tags";

/**
 * POST /api/revalidate
 * Secured hook for ops / wipe / DB scripts to bust Vercel Data Cache after
 * out-of-band DB mutations. Expires **every** CACHE_TAGS entry + list paths.
 *
 * Scripts: set REVALIDATE_SECRET + AUTH_URL (or APP_URL), then POST here.
 * See `invalidateAfterDbScript` in `src/lib/cache-tags.ts`.
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

  invalidateAfterDbScript();

  return NextResponse.json({
    ok: true,
    revalidated: true,
    tags: Object.values(CACHE_TAGS),
  });
}
